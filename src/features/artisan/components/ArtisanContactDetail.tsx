// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Loader2, Receipt, Save } from "lucide-react";

import {
  getContact,
  updateContact,
  type ArtisanContact,
  type ContactInput,
  type ContactInvoice,
  type ContactQuote,
} from "@/features/artisan/contacts/actions";
import type { ArtisanQuoteStatus } from "@/types/database.types";

const eurFromCents = (c: number) =>
  (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const QUOTE_STATUS: Record<ArtisanQuoteStatus, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-slate-800 text-slate-300" },
  sent: { label: "Envoyé", cls: "bg-sky-600/20 text-sky-300" },
  accepted: { label: "Accepté", cls: "bg-emerald-600/20 text-emerald-300" },
  rejected: { label: "Refusé", cls: "bg-red-600/20 text-red-300" },
};

const INVOICE_STATUS: Record<ContactInvoice["status"], { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-slate-800 text-slate-300" },
  sent: { label: "Envoyée", cls: "bg-sky-600/20 text-sky-300" },
  paid: { label: "Payée", cls: "bg-emerald-600/20 text-emerald-300" },
};

export function ArtisanContactDetail({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [contact, setContact] = useState<ArtisanContact | null>(null);
  const [quotes, setQuotes] = useState<ContactQuote[]>([]);
  const [invoices, setInvoices] = useState<ContactInvoice[]>([]);
  const [form, setForm] = useState<ContactInput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await getContact(contactId);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const c = result.data.contact;
    setContact(c);
    setForm({
      fullName: c.fullName,
      email: c.email ?? "",
      phone: c.phone ?? "",
      company: c.company ?? "",
      address: c.address ?? "",
      notes: c.notes ?? "",
    });
    setQuotes(result.data.quotes);
    setInvoices(result.data.invoices);
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateContact(contactId, form);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  };

  const set = (patch: Partial<ContactInput>) => setForm((f) => (f ? { ...f, ...patch } : f));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Chargement…
      </div>
    );
  }

  if (!contact || !form) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error ?? "Contact introuvable."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <div>
        <h2 className="text-3xl font-extrabold uppercase italic tracking-tighter text-white">{contact.fullName}</h2>
        {contact.company && <p className="mt-1 text-sm text-slate-400">{contact.company}</p>}
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom complet *">
            <input value={form.fullName ?? ""} onChange={(e) => set({ fullName: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Société">
            <input value={form.company ?? ""} onChange={(e) => set({ company: e.target.value })} className={inputCls} />
          </Field>
          <Field label="E-mail">
            <input type="email" value={form.email ?? ""} onChange={(e) => set({ email: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Téléphone">
            <input value={form.phone ?? ""} onChange={(e) => set({ phone: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Adresse" full>
            <input value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Notes" full>
            <textarea value={form.notes ?? ""} onChange={(e) => set({ notes: e.target.value })} className={`${inputCls} min-h-20`} />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-orange-400 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
          {saved && <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Enregistré</span>}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
          <FileText size={16} className="text-orange-400" /> Devis ({quotes.length})
        </h3>
        {quotes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun devis lié à ce contact.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {quotes.map((q) => {
              const st = QUOTE_STATUS[q.status];
              return (
                <li key={q.id}>
                  <Link
                    href={`/artisan/devis/${q.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-800/40"
                  >
                    <span className="text-xs text-slate-500">{new Date(q.createdAt).toLocaleDateString("fr-FR")}</span>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.cls}`}>{st.label}</span>
                      <strong className="text-white">{eurFromCents(q.grandTotalCents)}</strong>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-slate-300">
          <Receipt size={16} className="text-orange-400" /> Factures ({invoices.length})
        </h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune facture liée à ce contact.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {invoices.map((inv) => {
              const st = INVOICE_STATUS[inv.status];
              return (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium text-white">
                    {inv.invoiceNumber ?? "—"}
                    <span className="text-slate-500"> · {new Date(inv.createdAt).toLocaleDateString("fr-FR")}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.cls}`}>{st.label}</span>
                    <strong className="text-white">{eurFromCents(inv.grandTotalCents)}</strong>
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

function BackLink() {
  return (
    <Link
      href="/artisan/contacts"
      className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-orange-300"
    >
      <ArrowLeft size={14} /> Contacts
    </Link>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-orange-500/50 focus:outline-none";

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block space-y-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </label>
  );
}
