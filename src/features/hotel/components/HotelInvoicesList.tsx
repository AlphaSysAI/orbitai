// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { listInvoices, type InvoiceListItem } from "@/features/hotel/billing/actions";

const eurFromCents = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const STATUS: Record<InvoiceListItem["status"], string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
};

export function HotelInvoicesList() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await listInvoices();
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setInvoices(result.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <FileText size={26} className="text-sky-400" />
          Factures
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Factures générées depuis les séjours (nuits + taxe de séjour).
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8">
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucune facture. Générez-en une depuis la fiche d&apos;une réservation.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-white">
                    {inv.invoiceNumber ?? "—"}
                    <span className="text-slate-500"> · {inv.customerName || "Client"}</span>
                  </p>
                  <p className="text-xs text-slate-500">{new Date(inv.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                    {STATUS[inv.status]}
                  </span>
                  <strong className="text-white">{eurFromCents(inv.totalCents)}</strong>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
