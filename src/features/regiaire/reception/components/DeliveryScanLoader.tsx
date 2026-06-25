// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import { ScanWorkspace } from "@/features/regiaire/reception/components/ScanWorkspace";
import { useRegiaireOrg } from "@/features/regiaire/reception/hooks/useRegiaireOrg";
import type { DeliveryStatus } from "@/features/regiaire/reception/schemas";
import { createClient } from "@/utils/supabase/client";

export function DeliveryScanLoader({ deliveryId }: { deliveryId: string }) {
  const aireId = useRegiaireAireId();
  const { organizationId, isLoading: orgLoading, error: orgError } = useRegiaireOrg();
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [supplierName, setSupplierName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("deliveries")
        .select("id, status, suppliers(name)")
        .eq("id", deliveryId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (fetchError || !data) {
        setError(fetchError?.message ?? "Livraison introuvable");
        setIsLoading(false);
        return;
      }

      const rawSupplier = data.suppliers;
      const supplier = Array.isArray(rawSupplier) ? rawSupplier[0] : rawSupplier;
      setStatus(data.status as DeliveryStatus);
      setSupplierName((supplier as { name?: string } | null)?.name ?? "Fournisseur");
      setIsLoading(false);
    };

    void load();
  }, [deliveryId, organizationId]);

  if (orgLoading || isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (orgError || error || !status) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-red-300">{orgError ?? error ?? "Livraison introuvable"}</p>
        <Link href={`/station/${aireId}/deliveries`} className="mt-4 inline-block text-amber-400 underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  return (
    <ScanWorkspace
      deliveryId={deliveryId}
      initialStatus={status}
      supplierName={supplierName}
    />
  );
}
