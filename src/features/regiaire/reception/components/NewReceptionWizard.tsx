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

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <Link
        href={`/station/${aireId}/deliveries`}
        className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft size={14} />
        Réceptions
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
          Nouvelle réception
        </h1>
        {supplierName && step !== "supplier" && (
          <p className="mt-1 text-sm text-slate-400">{supplierName}</p>
        )}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {step === "supplier" && !resumeDeliveryId && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCreateNewSupplier(false)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold uppercase ${
                !createNewSupplier
                  ? "bg-amber-600 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              Existant
            </button>
            <button
              type="button"
              onClick={() => setCreateNewSupplier(true)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold uppercase ${
                createNewSupplier
                  ? "bg-amber-600 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              Nouveau
            </button>
          </div>

          {!createNewSupplier ? (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Fournisseur
              </span>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
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
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Nom
                </span>
                <input
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                  placeholder="Ex. Metro Cash & Carry"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Email (optionnel)
                </span>
                <input
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                  placeholder="contact@fournisseur.fr"
                />
              </label>
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSupplierNext()}
            disabled={isCreating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-4 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {isCreating && <Loader2 size={18} className="animate-spin" />}
            Continuer — capture BL
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
