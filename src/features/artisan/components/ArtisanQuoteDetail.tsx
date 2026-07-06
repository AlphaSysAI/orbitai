// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Pencil, Send, XCircle } from "lucide-react";

import {
  convertQuoteToInvoice,
  getQuote,
  updateQuoteStatus,
  type QuoteDetail,
} from "@/features/artisan/quotes/actions";
import { ArtisanQuoteEditForm } from "@/features/artisan/components/ArtisanQuoteEditForm";
import { downloadArtisanPdf } from "@/features/artisan/lib/document-pdf";
import type { ArtisanQuoteStatus } from "@/types/database.types";

const hoursLabel = (minutes: number) => `${Math.round((minutes / 60) * 100) / 100} h`;
const eurRaw = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

const eurFromCents = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const STATUS: Record<ArtisanQuoteStatus, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-slate-800 text-slate-300" },
  sent: { label: "Envoyé", cls: "bg-sky-600/20 text-sky-300" },
  accepted: { label: "Accepté", cls: "bg-emerald-600/20 text-emerald-300" },
  rejected: { label: "Refusé", cls: "bg-red-600/20 text-red-300" },
};

export function ArtisanQuoteDetail({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await getQuote(quoteId);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setQuote(result.data);
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (status: ArtisanQuoteStatus) => {
    setBusy(true);
    setError(null);
    const result = await updateQuoteStatus(quoteId, status);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await load();
  };

  const downloadPdf = () => {
    if (!quote) return;
    void downloadArtisanPdf({
      kind: "Devis",
      businessName: quote.businessName,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      date: quote.createdAt,
      labor: quote.services.map((s) => ({ label: s.label, detail: hoursLabel(s.durationMinutes), totalCents: s.lineTotalCents })),
      materials: quote.materials.map((m) => ({
        label: m.label,
        detail: `${m.quantity} × ${eurRaw(m.unitPriceCents)} €`,
        totalCents: m.lineTotalCents,
      })),
      laborTotalCents: quote.laborTotalCents,
      materialsTotalCents: quote.materialsTotalCents,
      grandTotalCents: quote.grandTotalCents,
      notes: quote.notes,
    });
  };

  const convert = async () => {
    setBusy(true);
    setError(null);
    const result = await convertQuoteToInvoice(quoteId);
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/artisan/factures");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-orange-400" size={32} />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="space-y-4">
        <Link href="/artisan" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200">
          <ArrowLeft size={14} /> Devis IA
        </Link>
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error ?? "Devis introuvable"}
        </p>
      </div>
    );
  }

  const st = STATUS[quote.status];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/artisan" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200">
          <ArrowLeft size={14} /> Devis IA
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl font-extrabold uppercase italic tracking-tighter text-white">
            {quote.customerName || "Devis"}
          </h2>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${st.cls}`}>
            {st.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {new Date(quote.createdAt).toLocaleDateString("fr-FR")}
          {quote.customerEmail ? ` · ${quote.customerEmail}` : ""}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {isEditing ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8">
          <ArtisanQuoteEditForm
            quote={quote}
            onSaved={() => {
              setIsEditing(false);
              void load();
            }}
            onCancel={() => setIsEditing(false)}
          />
        </section>
      ) : (
        <>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-6">
        {quote.services.length > 0 && (
          <LineGroup
            title="Main-d'œuvre"
            lines={quote.services.map((s) => ({
              label: s.label,
              detail: hoursLabel(s.durationMinutes),
              lineTotalCents: s.lineTotalCents,
            }))}
          />
        )}
        {quote.materials.length > 0 && (
          <LineGroup
            title="Matériaux"
            lines={quote.materials.map((m) => ({
              label: m.label,
              detail: `${m.quantity} × ${eurRaw(m.unitPriceCents)} €`,
              lineTotalCents: m.lineTotalCents,
            }))}
          />
        )}
        {quote.notes && <p className="text-sm text-slate-400">{quote.notes}</p>}

        <div className="flex flex-col gap-1 border-t border-slate-800 pt-4 text-sm">
          <Row label="Main-d'œuvre" value={eurFromCents(quote.laborTotalCents)} />
          <Row label="Matériaux" value={eurFromCents(quote.materialsTotalCents)} />
          <div className="flex justify-between text-base font-bold text-white">
            <span>Total</span>
            <span>{eurFromCents(quote.grandTotalCents)}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <button type="button" onClick={downloadPdf} className={actionCls("slate")}>
          <Download size={14} /> PDF
        </button>
        {quote.status === "draft" && (
          <button type="button" onClick={() => setIsEditing(true)} className={actionCls("slate")}>
            <Pencil size={14} /> Éditer
          </button>
        )}
        {quote.status === "draft" && (
          <button type="button" onClick={() => void setStatus("sent")} disabled={busy} className={actionCls("sky")}>
            <Send size={14} /> Marquer envoyé
          </button>
        )}
        {quote.status === "sent" && (
          <>
            <button type="button" onClick={() => void setStatus("accepted")} disabled={busy} className={actionCls("emerald")}>
              <CheckCircle2 size={14} /> Marquer accepté
            </button>
            <button type="button" onClick={() => void setStatus("rejected")} disabled={busy} className={actionCls("red")}>
              <XCircle size={14} /> Marquer refusé
            </button>
          </>
        )}
        {quote.invoiceId ? (
          <Link href="/artisan/factures" className={actionCls("orange")}>
            <FileText size={14} /> Voir la facture
          </Link>
        ) : (
          <button type="button" onClick={() => void convert()} disabled={busy} className={actionCls("orange")}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Convertir en facture
          </button>
        )}
      </section>
        </>
      )}
    </div>
  );
}

function LineGroup({
  title,
  lines,
}: {
  title: string;
  lines: { label: string; detail: string | null; lineTotalCents: number }[];
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
        {lines.map((l, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="text-slate-200">
              {l.label}
              {l.detail ? <span className="text-slate-500"> · {l.detail}</span> : null}
            </span>
            <strong className="shrink-0 text-white">{eurFromCents(l.lineTotalCents)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-400">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function actionCls(color: "sky" | "emerald" | "red" | "orange" | "slate") {
  const map = {
    sky: "bg-sky-600 hover:bg-sky-500",
    emerald: "bg-emerald-600 hover:bg-emerald-500",
    red: "bg-red-600 hover:bg-red-500",
    orange: "bg-orange-600 hover:bg-orange-500",
    slate: "bg-slate-700 hover:bg-slate-600",
  } as const;
  return `inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50 ${map[color]}`;
}
