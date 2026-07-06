// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

import {
  getInvoice,
  listInvoices,
  updateInvoiceStatus,
  type InvoiceListItem,
  type InvoiceStatus,
} from "@/features/artisan/invoices/actions";
import { downloadArtisanPdf } from "@/features/artisan/lib/document-pdf";

const eurFromCents = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const STATUS: Record<InvoiceStatus, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-slate-800 text-slate-300" },
  sent: { label: "Envoyée", cls: "bg-sky-600/20 text-sky-300" },
  paid: { label: "Payée", cls: "bg-emerald-600/20 text-emerald-300" },
};

const NEXT: Record<InvoiceStatus, InvoiceStatus | null> = {
  draft: "sent",
  sent: "paid",
  paid: null,
};

export function ArtisanInvoicesList() {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const downloadPdf = async (invoiceId: string) => {
    setBusyId(invoiceId);
    setError(null);
    const result = await getInvoice(invoiceId);
    setBusyId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const inv = result.data;
    void downloadArtisanPdf({
      kind: "Facture",
      number: inv.invoiceNumber,
      businessName: inv.businessName,
      customerName: inv.customerName,
      customerEmail: inv.customerEmail,
      date: inv.createdAt,
      labor: inv.labor.map((l) => ({ label: l.label, totalCents: l.totalCents })),
      materials: inv.materials.map((l) => ({ label: l.label, totalCents: l.totalCents })),
      laborTotalCents: inv.laborTotalCents,
      materialsTotalCents: inv.materialsTotalCents,
      grandTotalCents: inv.grandTotalCents,
      notes: inv.notes,
    });
  };

  const advance = async (inv: InvoiceListItem) => {
    const next = NEXT[inv.status];
    if (!next) return;
    setBusyId(inv.id);
    setError(null);
    const result = await updateInvoiceStatus(inv.id, next);
    setBusyId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <FileText size={26} className="text-orange-400" />
          Factures
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Factures issues des devis acceptés. Faites-les avancer : brouillon → envoyée → payée.
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
            Aucune facture. Convertissez un devis en facture depuis sa fiche.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {invoices.map((inv) => {
              const st = STATUS[inv.status];
              const next = NEXT[inv.status];
              return (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {inv.invoiceNumber ?? "—"}
                      <span className="text-slate-500"> · {inv.customerName || "Client"}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.cls}`}>
                      {st.label}
                    </span>
                    <strong className="text-white">{eurFromCents(inv.grandTotalCents)}</strong>
                    <button
                      type="button"
                      onClick={() => void downloadPdf(inv.id)}
                      disabled={busyId === inv.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-orange-500/40 hover:text-orange-300 disabled:opacity-50"
                    >
                      <Download size={12} /> PDF
                    </button>
                    {next && (
                      <button
                        type="button"
                        onClick={() => void advance(inv)}
                        disabled={busyId === inv.id}
                        className="rounded-lg border border-slate-700 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-orange-500/40 hover:text-orange-300 disabled:opacity-50"
                      >
                        {busyId === inv.id ? "…" : next === "sent" ? "Envoyer" : "Marquer payée"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
