"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";

import { BarcodeScanner } from "@/features/regiaire/reception/components/BarcodeScanner";
import { DeliveryStatusBadge } from "@/features/regiaire/reception/components/DeliveryStatusBadge";
import { FinalizeReportView } from "@/features/regiaire/reception/components/FinalizeReportView";
import { ManualEanInput } from "@/features/regiaire/reception/components/ManualEanInput";
import {
  DlcPromptModal,
  InstanceLinePickModal,
  UnknownEanKnownProductModal,
  UnknownEanNewProductModal,
} from "@/features/regiaire/reception/components/ReceptionModals";
import {
  ScanHeader,
  ScanLineList,
  type ScanLineView,
} from "@/features/regiaire/reception/components/ScanLineList";
import {
  ScanFeedbackToast,
  type ScanFeedbackKind,
} from "@/features/regiaire/reception/components/ScanFeedbackToast";
import {
  addUnexpectedLine,
  bindEanToLine,
  finalizeDelivery,
  lookupProductByEan,
  recordScan,
} from "@/features/regiaire/reception/actions";
import type {
  DeliveryStatus,
  FinalizeDeliveryReport,
  ProductLookup,
} from "@/features/regiaire/reception/schemas";
import { isTerminalStatus } from "@/features/regiaire/reception/utils/delivery-ui";
import {
  playScanError,
  playScanSuccess,
  playScanWarning,
} from "@/features/regiaire/reception/utils/scan-feedback";
import { createClient } from "@/utils/supabase/client";

type ScanWorkspaceProps = {
  deliveryId: string;
  initialStatus: DeliveryStatus;
  supplierName: string;
};

type FeedbackState = { kind: ScanFeedbackKind; message: string } | null;

export function ScanWorkspace({
  deliveryId,
  initialStatus,
  supplierName,
}: ScanWorkspaceProps) {
  const [status, setStatus] = useState(initialStatus);
  const [lines, setLines] = useState<ScanLineView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [report, setReport] = useState<FinalizeDeliveryReport | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const unknownCountsRef = useRef<Map<string, number>>(new Map());
  const [pendingUnknownEan, setPendingUnknownEan] = useState<string | null>(null);
  const [knownProduct, setKnownProduct] = useState<ProductLookup | null>(null);
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [instancePick, setInstancePick] = useState<{
    ean: string;
    lines: Array<{ id: string; raw_name: string }>;
  } | null>(null);
  const [dlcPrompt, setDlcPrompt] = useState<{
    lineId: string;
    productName: string;
  } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const terminal = isTerminalStatus(status);

  const loadLines = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("delivery_lines")
      .select(
        "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc, needs_review, products(has_dlc)"
      )
      .eq("delivery_id", deliveryId)
      .order("raw_name");

    if (error) {
      setFeedback({ kind: "error", message: error.message });
      return;
    }

    const mapped: ScanLineView[] = (data ?? []).map((row) => {
      const products = row.products as { has_dlc?: boolean } | null;
      return {
        id: row.id,
        delivery_id: row.delivery_id,
        product_id: row.product_id,
        raw_name: row.raw_name,
        ean: row.ean,
        expected_qty: row.expected_qty,
        scanned_qty: row.scanned_qty,
        dlc: row.dlc,
        has_dlc: products?.has_dlc ?? false,
      };
    });
    setLines(mapped);
  }, [deliveryId]);

  useEffect(() => {
    void loadLines().finally(() => setIsLoading(false));
  }, [loadLines]);

  const showFeedback = (kind: ScanFeedbackKind, message: string) => {
    setFeedback({ kind, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleDlcSave = async (dlc: string) => {
    if (!dlcPrompt) return;
    setModalLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("delivery_lines")
      .update({ dlc })
      .eq("id", dlcPrompt.lineId);
    setModalLoading(false);
    setDlcPrompt(null);
    if (error) {
      playScanError();
      showFeedback("error", error.message);
    } else {
      await loadLines();
    }
  };

  const handleScan = async (ean: string) => {
    if (terminal || isScanning) return;
    setIsScanning(true);

    const result = await recordScan(deliveryId, ean);

    if (!result.success) {
      playScanError();
      showFeedback("error", result.error);
      setIsScanning(false);
      return;
    }

    const data = result.data;

    if (data.status === "not_in_bl") {
      playScanWarning();
      const instanceLines = lines.filter((l) => !l.ean);

      if (instanceLines.length > 0) {
        setInstancePick({
          ean,
          lines: instanceLines.map((l) => ({
            id: l.id,
            raw_name: l.raw_name,
          })),
        });
        showFeedback("warning", "Choisissez la ligne en instance correspondante");
        setIsScanning(false);
        return;
      }

      const count = (unknownCountsRef.current.get(ean) ?? 0) + 1;
      unknownCountsRef.current.set(ean, count);
      showFeedback(
        "warning",
        count === 1
          ? "EAN absent du BL — rescannez pour confirmer"
          : "EAN toujours absent — vérification produit…"
      );

      if (count >= 2) {
        const lookup = await lookupProductByEan(ean);
        if (!lookup.success) {
          playScanError();
          showFeedback("error", lookup.error);
        } else if (lookup.product) {
          setKnownProduct(lookup.product);
          setPendingUnknownEan(ean);
        } else {
          setPendingUnknownEan(ean);
          setShowNewProductModal(true);
        }
      }
      setIsScanning(false);
      return;
    }

    playScanSuccess();
    await loadLines();

    if (!data.dlc) {
      const supabase = createClient();
      const { data: freshLine } = await supabase
        .from("delivery_lines")
        .select("id, raw_name, dlc, products(has_dlc)")
        .eq("id", data.lineId)
        .single();

      const prod = freshLine?.products as { has_dlc?: boolean } | null;
      if (prod?.has_dlc && !freshLine?.dlc) {
        setDlcPrompt({
          lineId: data.lineId,
          productName: freshLine?.raw_name ?? data.ean,
        });
      }
    }

    showFeedback("success", `Scanné ${data.scannedQty} / ${data.expectedQty}`);
    unknownCountsRef.current.delete(ean);
    setIsScanning(false);
  };

  const handleBindInstanceLine = async (lineId: string) => {
    if (!instancePick) return;
    setModalLoading(true);
    const res = await bindEanToLine(deliveryId, lineId, instancePick.ean);
    setModalLoading(false);

    if (!res.success) {
      playScanError();
      showFeedback("error", res.error);
      return;
    }

    playScanSuccess();
    setInstancePick(null);
    await loadLines();

    if (!res.data.dlc) {
      const supabase = createClient();
      const { data: freshLine } = await supabase
        .from("delivery_lines")
        .select("id, raw_name, dlc, products(has_dlc)")
        .eq("id", res.data.lineId)
        .single();

      const prod = freshLine?.products as { has_dlc?: boolean } | null;
      if (prod?.has_dlc && !freshLine?.dlc) {
        setDlcPrompt({
          lineId: res.data.lineId,
          productName: freshLine?.raw_name ?? res.data.ean,
        });
      }
    }

    showFeedback(
      "success",
      `EAN lié — scanné ${res.data.scannedQty} / ${res.data.expectedQty}`
    );
  };

  const handleInstancePickUnexpected = () => {
    if (!instancePick) return;
    const ean = instancePick.ean;
    setPendingUnknownEan(ean);
    setInstancePick(null);
    void (async () => {
      const lookup = await lookupProductByEan(ean);
      if (!lookup.success) {
        playScanError();
        showFeedback("error", lookup.error);
        return;
      }
      if (lookup.product) {
        setKnownProduct(lookup.product);
      } else {
        setShowNewProductModal(true);
      }
    })();
  };

  const handleAddKnownProduct = async () => {
    if (!pendingUnknownEan || !knownProduct) return;
    setModalLoading(true);
    const res = await addUnexpectedLine(deliveryId, pendingUnknownEan, {
      productId: knownProduct.id,
    });
    setModalLoading(false);
    if (!res.success) {
      playScanError();
      showFeedback("error", res.error);
      return;
    }
    playScanSuccess();
    setPendingUnknownEan(null);
    setKnownProduct(null);
    unknownCountsRef.current.delete(pendingUnknownEan);
    await loadLines();
    showFeedback("success", "Ligne non-attendue ajoutée");
  };

  const handleAddNewProduct = async (name: string) => {
    if (!pendingUnknownEan) return;
    setModalLoading(true);
    const res = await addUnexpectedLine(deliveryId, pendingUnknownEan, {
      newName: name,
    });
    setModalLoading(false);
    if (!res.success) {
      playScanError();
      showFeedback("error", res.error);
      return;
    }
    playScanSuccess();
    setShowNewProductModal(false);
    setPendingUnknownEan(null);
    unknownCountsRef.current.delete(pendingUnknownEan);
    await loadLines();
    showFeedback("success", "Produit créé et ajouté");
  };

  const handleFinalize = async () => {
    if (terminal) return;
    setIsFinalizing(true);
    setFinalizeError(null);
    const result = await finalizeDelivery(deliveryId);
    setIsFinalizing(false);

    if (!result.success) {
      playScanError();
      if (result.error.includes("déjà été finalisée")) {
        const supabase = createClient();
        const { data } = await supabase
          .from("deliveries")
          .select("status")
          .eq("id", deliveryId)
          .maybeSingle();
        if (data?.status) {
          setStatus(data.status as DeliveryStatus);
        }
      }
      setFinalizeError(result.error);
      return;
    }

    playScanSuccess();
    setReport(result.data);
    setStatus(result.data.status);
  };

  if (report) {
    return <FinalizeReportView report={report} supplierName={supplierName} />;
  }

  if (status === "draft") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-slate-400">Cette livraison n&apos;a pas encore de BL analysé.</p>
        <Link
          href={`/station/deliveries/new?deliveryId=${deliveryId}`}
          className="mt-4 inline-block text-amber-400 underline"
        >
          Analyser le bon de livraison
        </Link>
      </div>
    );
  }

  if (terminal && !report) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <Lock className="mx-auto text-slate-500" size={32} />
        <p className="font-bold text-white">Réception déjà finalisée</p>
        <DeliveryStatusBadge status={status} />
        <Link href="/station/deliveries" className="block text-amber-400 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <ScanHeader lines={lines} />

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <div className="flex items-center justify-between">
          <DeliveryStatusBadge status={status} />
          <span className="text-xs text-slate-500">{supplierName}</span>
        </div>

        {feedback && (
          <ScanFeedbackToast kind={feedback.kind} message={feedback.message} />
        )}

        {finalizeError && (
          <ScanFeedbackToast kind="error" message={finalizeError} />
        )}

        {!terminal && (
          <>
            <BarcodeScanner
              onDetect={(code) => void handleScan(code)}
              disabled={isScanning}
            />
            <ManualEanInput
              onSubmit={(code) => void handleScan(code)}
              disabled={isScanning}
            />
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-amber-400" />
        </div>
      ) : (
        <ScanLineList lines={lines} />
      )}

      {!terminal && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-[#0f172a]/95 p-4 backdrop-blur-md">
          <button
            type="button"
            onClick={() => void handleFinalize()}
            disabled={isFinalizing || lines.length === 0}
            className="mx-auto flex w-full max-w-lg items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {isFinalizing && <Loader2 size={18} className="animate-spin" />}
            Finaliser la réception
          </button>
        </div>
      )}

      {instancePick && (
        <InstanceLinePickModal
          ean={instancePick.ean}
          lines={instancePick.lines}
          onPickLine={(lineId) => void handleBindInstanceLine(lineId)}
          onPickUnexpected={handleInstancePickUnexpected}
          onCancel={() => setInstancePick(null)}
          isLoading={modalLoading}
        />
      )}

      {pendingUnknownEan && knownProduct && (
        <UnknownEanKnownProductModal
          ean={pendingUnknownEan}
          product={knownProduct}
          onConfirm={() => void handleAddKnownProduct()}
          onCancel={() => {
            setPendingUnknownEan(null);
            setKnownProduct(null);
          }}
          isLoading={modalLoading}
        />
      )}

      {showNewProductModal && pendingUnknownEan && (
        <UnknownEanNewProductModal
          ean={pendingUnknownEan}
          onConfirm={(name) => void handleAddNewProduct(name)}
          onCancel={() => {
            setShowNewProductModal(false);
            setPendingUnknownEan(null);
          }}
          isLoading={modalLoading}
        />
      )}

      {dlcPrompt && (
        <DlcPromptModal
          productName={dlcPrompt.productName}
          onConfirm={(dlc) => void handleDlcSave(dlc)}
          onCancel={() => setDlcPrompt(null)}
          isLoading={modalLoading}
        />
      )}
    </div>
  );
}
