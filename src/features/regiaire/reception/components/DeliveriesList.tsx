"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, Plus, Truck } from "lucide-react";

import { DeliveryStatusBadge } from "@/features/regiaire/reception/components/DeliveryStatusBadge";
import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import { useRegiaireOrg } from "@/features/regiaire/reception/hooks/useRegiaireOrg";
import type { DeliveryStatus } from "@/features/regiaire/reception/schemas";
import { createClient } from "@/utils/supabase/client";

type DeliveryListItem = {
  id: string;
  status: DeliveryStatus;
  created_at: string;
  supplierName: string;
  bl_file_path: string | null;
};

function deliveryHref(
  aireId: string,
  item: DeliveryListItem
): string {
  if (item.status === "draft") {
    return `/station/${aireId}/deliveries/new?deliveryId=${item.id}`;
  }
  return `/station/${aireId}/deliveries/${item.id}/scan`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function DeliveriesList() {
  const aireId = useRegiaireAireId();
  const { organizationId, isLoading: orgLoading, error: orgError } = useRegiaireOrg();
  const [deliveries, setDeliveries] = useState<DeliveryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDeliveries = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("deliveries")
      .select("id, status, created_at, bl_file_path, suppliers(name)")
      .eq("organization_id", organizationId)
      .eq("aire_id", aireId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    const mapped: DeliveryListItem[] = (data ?? []).map((row) => {
      const rawSupplier = row.suppliers;
      const supplier = Array.isArray(rawSupplier) ? rawSupplier[0] : rawSupplier;
      return {
        id: row.id,
        status: row.status as DeliveryStatus,
        created_at: row.created_at,
        supplierName: (supplier as { name?: string } | null)?.name ?? "Fournisseur",
        bl_file_path: row.bl_file_path,
      };
    });

    setDeliveries(mapped);
    setIsLoading(false);
  }, [organizationId, aireId]);

  useEffect(() => {
    if (organizationId) {
      void loadDeliveries();
    }
  }, [organizationId, loadDeliveries]);

  if (orgLoading || (isLoading && organizationId)) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (orgError || error) {
    return (
      <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {orgError ?? error}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/station/${aireId}/deliveries/new`}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 py-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-amber-500"
      >
        <Plus size={18} />
        Nouvelle réception
      </Link>

      {deliveries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-12 text-center">
          <Truck className="mx-auto text-slate-600" size={36} />
          <p className="mt-3 text-sm text-slate-500">Aucune réception pour le moment.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {deliveries.map((item) => (
            <li key={item.id}>
              <Link
                href={deliveryHref(aireId, item)}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:border-amber-500/30 hover:bg-slate-900"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{item.supplierName}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(item.created_at)}</p>
                </div>
                <DeliveryStatusBadge status={item.status} />
                <ChevronRight size={18} className="shrink-0 text-slate-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
