// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";

import { analyzeBL } from "@/features/regiaire/reception/actions";
import { BlCaptureForm } from "@/features/regiaire/reception/components/BlCaptureForm";
import { BlReviewEditor } from "@/features/regiaire/reception/components/BlReviewEditor";
import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import { useRegiaireOrg } from "@/features/regiaire/reception/hooks/useRegiaireOrg";
import type { DeliveryStatus } from "@/features/regiaire/reception/schemas";
import { createClient } from "@/utils/supabase/client";

type SupplierOption = {
  id: string;
  name: string;
  email: string | null;
};

type WizardStep = "supplier" | "capture" | "review";

export function NewReceptionWizard({ resumeDeliveryId }: { resumeDeliveryId?: string }) {
  const router = useRouter();
  const aireId = useRegiaireAireId();
  const { organizationId, userId, isLoading: orgLoading, error: orgError } = useRegiaireOrg();

  const [step, setStep] = useState<WizardStep>("supplier");
  const [deliveryId, setDeliveryId] = useState<string | null>(resumeDeliveryId ?? null);
  const [supplierName, setSupplierName] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [createNewSupplier, setCreateNewSupplier] = useState(false);

  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuppliers = useCallback(async () => {
    if (!organizationId) return;
    setIsLoadingSuppliers(true);
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("suppliers")
      .select("id, name, email")
      .eq("organization_id", organizationId)
      .order("name");

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setSuppliers((data ?? []) as SupplierOption[]);
    }
    setIsLoadingSuppliers(false);
  }, [organizationId]);

  const loadExistingDelivery = useCallback(async () => {
    if (!resumeDeliveryId || !organizationId) return;

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("deliveries")
      .select("id, status, bl_file_path, suppliers(name)")
      .eq("id", resumeDeliveryId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (fetchError || !data) {
      setError(fetchError?.message ?? "Livraison introuvable");
      return;
    }

    const rawSupplier = data.suppliers;
    const supplier = Array.isArray(rawSupplier) ? rawSupplier[0] : rawSupplier;
    setDeliveryId(data.id);
    setSupplierName((supplier as { name?: string } | null)?.name ?? null);

    const status = data.status as DeliveryStatus;
    if (status === "scanning") {
      router.replace(`/station/${aireId}/deliveries/${data.id}/scan`);
      return;
    }
    if (status === "draft") {
      if (data.bl_file_path) {
        const { count } = await supabase
          .from("delivery_lines")
          .select("id", { count: "exact", head: true })
          .eq("delivery_id", data.id);
        setStep(count && count > 0 ? "review" : "capture");
      } else {
        setStep("capture");
      }
    }
  }, [resumeDeliveryId, organizationId, router, aireId]);

  useEffect(() => {
    if (organizationId) {
      void loadSuppliers();
    }
  }, [organizationId, loadSuppliers]);

  useEffect(() => {
    if (resumeDeliveryId && organizationId) {
      void loadExistingDelivery();
    }
  }, [resumeDeliveryId, organizationId, loadExistingDelivery]);

  const createDelivery = async (): Promise<string | null> => {
    if (!organizationId || !userId) {
      setError("Session ou organisation manquante");
      return null;
    }

    setIsCreating(true);
    setError(null);
    const supabase = createClient();

    let supplierId = selectedSupplierId;
    let name = suppliers.find((s) => s.id === supplierId)?.name ?? null;

    if (createNewSupplier) {
      const trimmed = newSupplierName.trim();
      if (!trimmed) {
        setError("Nom du fournisseur requis");
        setIsCreating(false);
        return null;
      }

      const { data: created, error: supplierError } = await supabase
        .from("suppliers")
        .insert({
          organization_id: organizationId,
          name: trimmed,
          email: newSupplierEmail.trim() || null,
        })
        .select("id, name")
        .single();

      if (supplierError || !created) {
        setError(supplierError?.message ?? "Échec création fournisseur");
        setIsCreating(false);
        return null;
      }

      supplierId = created.id;
      name = created.name;
    }

    if (!supplierId) {
      setError("Sélectionnez ou créez un fournisseur");
      setIsCreating(false);
      return null;
    }

    const { data: delivery, error: deliveryError } = await supabase
      .from("deliveries")
      .insert({
        organization_id: organizationId,
        aire_id: aireId,
        supplier_id: supplierId,
        status: "draft",
        created_by: userId,
      })
      .select("id")
      .single();

    setIsCreating(false);

    if (deliveryError || !delivery) {
      setError(deliveryError?.message ?? "Échec création livraison");
      return null;
    }

    setDeliveryId(delivery.id);
    setSupplierName(name);
    return delivery.id;
  };

  const handleSupplierNext = async () => {
    const id = await createDelivery();
    if (id) setStep("capture");
  };

  const handleBlSubmit = async (file: File) => {
    if (!deliveryId) return;
    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.set("file", file);

    const result = await analyzeBL(aireId, deliveryId, formData);
    setIsAnalyzing(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setStep("review");
  };

  const handleReviewConfirmed = () => {
    if (deliveryId) {
      router.push(`/station/${aireId}/deliveries/${deliveryId}/scan`);
    }
  };

  if (orgLoading || isLoadingSuppliers) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (orgError) {
    return (
      <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {orgError}
      </p>
    );
  }

  const STEPS: { id: WizardStep; label: string }[] = [
    { id: "supplier", label: "Fournisseur" },
    { id: "capture", label: "Bon de livraison" },
    { id: "review", label: "Vérification" },
  ];
  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      {/* Back link */}
      <Link
        href={`/station/${aireId}/deliveries`}
        className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-600 transition-colors hover:text-slate-300"
      >
        <ArrowLeft size={13} />
        Réceptions
      </Link>

      {/* Page header */}
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-700">
          Nouvelle réception
        </p>
        <h1 className="mt-0.5 text-xl font-black uppercase tracking-tight text-white">
          {supplierName && step !== "supplier" ? supplierName : "Créer une réception"}
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const isDone = i < currentStepIdx;
          const isActive = i === currentStepIdx;
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-black transition-all ${
                  isDone
                    ? "bg-emerald-500 text-black"
                    : isActive
                      ? "bg-amber-500 text-black"
                      : "border border-slate-700 bg-slate-900 text-slate-600"
                }`}>
                  {isDone ? "✓" : i + 1}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-wider ${
                  isActive ? "text-amber-400" : isDone ? "text-emerald-500" : "text-slate-700"
                }`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mb-4 h-px flex-1 transition-all ${i < currentStepIdx ? "bg-emerald-500/40" : "bg-slate-800"}`} />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {step === "supplier" && !resumeDeliveryId && (
        <div className="space-y-4">
          {/* Segmented control */}
          <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <button
              type="button"
              onClick={() => setCreateNewSupplier(false)}
              className={`flex-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                !createNewSupplier
                  ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                  : "text-slate-600 hover:text-slate-300"
              }`}
            >
              Fournisseur existant
            </button>
            <button
              type="button"
              onClick={() => setCreateNewSupplier(true)}
              className={`flex-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
                createNewSupplier
                  ? "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
                  : "text-slate-600 hover:text-slate-300"
              }`}
            >
              Nouveau fournisseur
            </button>
          </div>

          {!createNewSupplier ? (
            <label className="block space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                Fournisseur
              </span>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white focus:border-amber-500/50 focus:outline-none"
              >
                <option value="">— Choisir —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                  Nom du fournisseur *
                </span>
                <input
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:border-amber-500/50 focus:outline-none"
                  placeholder="Ex. Metro Cash & Carry"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                  Email <span className="text-slate-700">(optionnel)</span>
                </span>
                <input
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-700 focus:border-amber-500/50 focus:outline-none"
                  placeholder="contact@fournisseur.fr"
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSupplierNext()}
            disabled={isCreating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3.5 text-[11px] font-black uppercase tracking-wider text-black transition-all hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50"
          >
            {isCreating && <Loader2 size={16} className="animate-spin" />}
            Continuer → Capture BL
          </button>
        </div>
      )}

      {step === "capture" && deliveryId && (
        <BlCaptureForm
          onSubmit={(file) => void handleBlSubmit(file)}
          isSubmitting={isAnalyzing}
          error={error}
        />
      )}

      {step === "review" && deliveryId && (
        <BlReviewEditor deliveryId={deliveryId} onConfirmed={handleReviewConfirmed} />
      )}
    </div>
  );
}
