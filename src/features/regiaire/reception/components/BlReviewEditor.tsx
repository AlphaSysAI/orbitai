"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { confirmReview } from "@/features/regiaire/reception/actions";
import {
  UNREADABLE_LINE_NAME,
  type DeliveryLineRow,
} from "@/features/regiaire/reception/schemas";
import { computeNeedsReviewFromEdits } from "@/features/regiaire/reception/validate-bl-line";
import { createClient } from "@/utils/supabase/client";

export function BlReviewEditor({
  deliveryId,
  onConfirmed,
}: {
  deliveryId: string;
  onConfirmed: () => void;
}) {
  const [lines, setLines] = useState<DeliveryLineRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLines = async () => {
    setIsLoading(true);
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("delivery_lines")
      .select(
        "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc, needs_review"
      )
      .eq("delivery_id", deliveryId)
      .order("raw_name");

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setLines((data ?? []) as DeliveryLineRow[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    void loadLines();
  }, [deliveryId]);

  const hasBlockingReview = useMemo(
    () =>
      lines.some(
        (line) =>
          line.needs_review ||
          computeNeedsReviewFromEdits(line.raw_name, line.expected_qty)
      ),
    [lines]
  );

  const updateLine = (id: string, patch: Partial<DeliveryLineRow>) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        next.needs_review = computeNeedsReviewFromEdits(
          next.raw_name,
          next.expected_qty
        );
        return next;
      })
    );
  };

  const saveAndConfirm = async () => {
    if (hasBlockingReview) return;

    setIsSaving(true);
    setError(null);
    const supabase = createClient();

    for (const line of lines) {
      const needsReview = computeNeedsReviewFromEdits(
        line.raw_name,
        line.expected_qty
      );

      const { error: updateError } = await supabase
        .from("delivery_lines")
        .update({
          raw_name: line.raw_name,
          expected_qty: line.expected_qty,
          dlc: line.dlc,
          needs_review: needsReview,
        })
        .eq("id", line.id);

      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }
    }

    const result = await confirmReview(deliveryId);
    setIsSaving(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onConfirmed();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <div>
        <h2 className="text-lg font-bold text-white">Revue du bon de livraison</h2>
        <p className="text-sm text-slate-400">
          Corrigez le nom et la quantité (champs ambre). EAN et DLC manquants seront
          saisis au scan.
        </p>
      </div>

      {hasBlockingReview && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-600/10 px-4 py-2 text-sm text-amber-300">
          <AlertTriangle size={16} />
          Certaines lignes nécessitent une correction avant confirmation.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {lines.map((line) => {
          const nameUncertain =
            !line.raw_name.trim() || line.raw_name === UNREADABLE_LINE_NAME;
          const qtyUncertain = line.expected_qty <= 0;

          return (
            <li
              key={line.id}
              className={`rounded-xl border bg-slate-900/50 p-3 space-y-2 ${
                line.needs_review ? "border-amber-500/40" : "border-slate-800"
              }`}
            >
              <label className="block text-[10px] uppercase text-slate-500">
                Nom produit
                <input
                  value={line.raw_name}
                  onChange={(e) =>
                    updateLine(line.id, { raw_name: e.target.value })
                  }
                  className={`mt-1 w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-white ${
                    nameUncertain
                      ? "border-amber-500/60 ring-1 ring-amber-500/30"
                      : "border-slate-700"
                  }`}
                />
              </label>

              <p className="font-mono text-xs text-slate-500">
                {line.ean ? `EAN ${line.ean}` : "EAN au scan"}
              </p>

              <div className="flex gap-2">
                <label className="flex-1 text-[10px] uppercase text-slate-500">
                  Qté attendue
                  <input
                    type="number"
                    min={1}
                    value={line.expected_qty || ""}
                    onChange={(e) =>
                      updateLine(line.id, {
                        expected_qty: Math.max(
                          0,
                          parseInt(e.target.value, 10) || 0
                        ),
                      })
                    }
                    className={`mt-1 w-full rounded-lg border bg-slate-950 px-3 py-2 text-white ${
                      qtyUncertain
                        ? "border-amber-500/60 ring-1 ring-amber-500/30"
                        : "border-slate-700"
                    }`}
                  />
                </label>
                <label className="flex-1 text-[10px] uppercase text-slate-500">
                  DLC
                  <input
                    type="date"
                    value={line.dlc ?? ""}
                    onChange={(e) =>
                      updateLine(line.id, { dlc: e.target.value || null })
                    }
                    placeholder="DLC au scan"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  />
                  {!line.dlc && (
                    <span className="mt-1 block text-[10px] text-slate-600">
                      DLC au scan
                    </span>
                  )}
                </label>
              </div>
            </li>
          );
        })}
      </ul>

      {lines.length === 0 && (
        <p className="text-sm text-slate-500">Aucune ligne extraite.</p>
      )}

      <button
        type="button"
        onClick={() => void saveAndConfirm()}
        disabled={isSaving || lines.length === 0 || hasBlockingReview}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-4 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
      >
        {isSaving && <Loader2 size={18} className="animate-spin" />}
        Confirmer et passer au scan
      </button>
    </div>
  );
}
