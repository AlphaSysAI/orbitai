// Copyright © 2026 OrbitSys. Tous droits réservés.

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
    <div className="space-y-5">
      {/* CTA */}
      <Link
        href={`/station/${aireId}/deliveries/new`}
        className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-amber-500 py-3.5 text-[11px] font-black uppercase tracking-wider text-black transition-all hover:bg-amber-400 hover:shadow-lg hover:shadow-amber-500/20"
      >
        <Plus size={16} />
        Nouvelle réception
      </Link>

      {/* Separator */}
      {deliveries.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
            Historique · {deliveries.length}
          </span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>
      )}

      {deliveries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 py-14 text-center">
          <Truck className="mx-auto text-slate-700" size={32} />
          <p className="mt-3 text-sm font-medium text-slate-600">Aucune réception enregistrée.</p>
          <p className="mt-1 text-xs text-slate-700">Créez votre première réception ci-dessus.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {deliveries.map((item) => (
            <li key={item.id}>
              <Link
                href={deliveryHref(aireId, item)}
                className="group flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3.5 transition-all duration-150 hover:border-slate-700 hover:bg-slate-900"
              >
                {/* Status dot */}
                <div className={`h-2 w-2 shrink-0 rounded-full ${
                  item.status === "completed" ? "bg-emerald-400" :
                  item.status === "draft" ? "bg-slate-600" :
                  "bg-amber-400"
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{item.supplierName}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(item.created_at)}</p>
                </div>
                <DeliveryStatusBadge status={item.status} />
                <ChevronRight size={15} className="shrink-0 text-slate-700 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
