// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Loader2, Save, Sparkles, Wrench } from "lucide-react";

import { generateQuoteDraft } from "@/features/artisan/quotes/generate-quote-draft";
import {
  createQuoteFromDraft,
  listQuotes,
  type QuoteListItem,
} from "@/features/artisan/quotes/actions";
import { listContacts, type ArtisanContact } from "@/features/artisan/contacts/actions";
import type { QuoteDraft } from "@/features/artisan/quotes/schemas";

const eur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const eurFromCents = (c: number) => eur(c / 100);

const QUOTE_STATUS_LABELS: Record<QuoteListItem["status"], string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
};

function draftTotals(draft: QuoteDraft) {
  const labor = draft.labor_items.reduce((s, l) => s + l.hours * l.hourly_rate_eur, 0);
  const materials = draft.materials.reduce((s, m) => s + m.quantity * m.unit_price_eur, 0);
  return { labor, materials, grand: labor + materials };
}

export function ArtisanQuoteComposer() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuoteDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [contacts, setContacts] = useState<ArtisanContact[]>([]);
  const [contactId, setContactId] = useState<string>("");

  const loadQuotes = useCallback(async () => {
    const result = await listQuotes();
    if (result.success) setQuotes(result.data);
  }, []);

  const loadContacts = useCallback(async () => {
    const result = await listContacts();
    if (result.success) setContacts(result.data);
  }, []);

  useEffect(() => {
    void loadQuotes();
    void loadContacts();
  }, [loadQuotes, loadContacts]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setDraft(null);
    setSaved(false);
    const result = await generateQuoteDraft(text);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setDraft(result.data);
  };

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    setError(null);
    const result = await createQuoteFromDraft(draft, contactId || null);
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setDraft(null);
    setText("");
    setContactId("");
    await loadQuotes();
  };

  const totals = draft ? draftTotals(draft) : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          <Wrench size={26} className="text-orange-400" />
          Orbit Artisan
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Décrivez la demande du client — l&apos;IA en extrait un brouillon de devis que
          vous ajustez avant de l&apos;envoyer.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-4">
        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Demande du client
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Ex. Le client souhaite refaire l'étanchéité d'une terrasse de 20 m², avec pose d'un nouveau revêtement et évacuation des gravats…"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500 placeholder:text-slate-600"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isLoading}
          className="flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-orange-500 disabled:opacity-50"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          Générer le brouillon
        </button>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 size={16} />
            Devis enregistré en brouillon.
          </p>
        )}
      </section>

      {draft && totals && (
        <section className="rounded-2xl border border-orange-500/20 bg-orange-600/5 p-4 sm:p-8 space-y-6">
          <div className="flex items-center gap-2 text-orange-300">
            <Sparkles size={18} />
            <h3 className="text-sm font-black uppercase tracking-wider">Brouillon de devis</h3>
          </div>

          {draft.customer_name && (
            <p className="text-sm text-slate-300">
              Client : <strong className="text-white">{draft.customer_name}</strong>
            </p>
          )}

          {draft.labor_items.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Main-d&apos;œuvre
              </p>
              <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                {draft.labor_items.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="text-slate-200">{l.label}</span>
                    <span className="shrink-0 text-slate-400">
                      {l.hours} h × {eur(l.hourly_rate_eur)} ={" "}
                      <strong className="text-white">{eur(l.hours * l.hourly_rate_eur)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.materials.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Matériaux
              </p>
              <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                {draft.materials.map((m, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="text-slate-200">{m.label}</span>
                    <span className="shrink-0 text-slate-400">
                      {m.quantity} × {eur(m.unit_price_eur)} ={" "}
                      <strong className="text-white">{eur(m.quantity * m.unit_price_eur)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {draft.catalog_service_titles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.catalog_service_titles.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-300"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {draft.notes && <p className="text-sm text-slate-400">{draft.notes}</p>}

          <div className="flex flex-col gap-1 border-t border-slate-800 pt-4 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Main-d&apos;œuvre</span>
              <span>{eur(totals.labor)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Matériaux</span>
              <span>{eur(totals.materials)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-white">
              <span>Total estimé</span>
              <span>{eur(totals.grand)}</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Rattacher à un contact (optionnel)
              </span>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
              >
                <option value="">— Aucun contact —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                    {c.company ? ` · ${c.company}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {contactId && (
              <p className="mt-2 text-[11px] text-slate-500">
                Le nom et l&apos;e-mail du contact seront utilisés sur le devis.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Enregistrer en brouillon
            </button>
            <p className="text-[11px] text-slate-500">
              Brouillon généré par l&apos;IA — vérifiez et ajustez avant de l&apos;envoyer.
            </p>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8">
        <div className="mb-6 flex items-center gap-2 text-slate-300">
          <FileText size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">Devis récents</h3>
        </div>
        {quotes.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun devis pour le moment.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {quotes.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/artisan/devis/${q.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {q.customerName || "Client non renseigné"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(q.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                      {QUOTE_STATUS_LABELS[q.status]}
                    </span>
                    <strong className="text-white">{eurFromCents(q.grandTotalCents)}</strong>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
