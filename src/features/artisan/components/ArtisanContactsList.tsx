// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Loader2, Mail, Phone, Plus, Trash2, Users } from "lucide-react";

import {
  createContact,
  deleteContact,
  listContacts,
  type ArtisanContact,
  type ContactInput,
} from "@/features/artisan/contacts/actions";

const EMPTY: ContactInput = {
  fullName: "",
  email: "",
  phone: "",
  company: "",
  address: "",
  notes: "",
};

export function ArtisanContactsList() {
  const [contacts, setContacts] = useState<ArtisanContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ContactInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    const result = await listContacts();
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setError(null);
    setContacts(result.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const result = await createContact(form);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setForm(EMPTY);
    setShowForm(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce contact ? Les devis et factures liés sont conservés.")) return;
    setBusyId(id);
    setError(null);
    const result = await deleteContact(id);
    setBusyId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await load();
  };

  const set = (patch: Partial<ContactInput>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-extrabold uppercase italic tracking-tighter text-white">
            <Users size={26} className="text-orange-400" />
            Contacts
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Votre carnet de clients : coordonnées et historique des devis et factures.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setForm(EMPTY);
            setShowForm((s) => !s);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-orange-400"
        >
          <Plus size={14} /> Nouveau contact
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {showForm && (
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom complet *">
              <input
                value={form.fullName ?? ""}
                onChange={(e) => set({ fullName: e.target.value })}
                className={inputCls}
                placeholder="Jean Dupont"
              />
            </Field>
            <Field label="Société">
              <input
                value={form.company ?? ""}
                onChange={(e) => set({ company: e.target.value })}
                className={inputCls}
                placeholder="Dupont SARL"
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set({ email: e.target.value })}
                className={inputCls}
                placeholder="jean@exemple.fr"
              />
            </Field>
            <Field label="Téléphone">
              <input
                value={form.phone ?? ""}
                onChange={(e) => set({ phone: e.target.value })}
                className={inputCls}
                placeholder="06 12 34 56 78"
              />
            </Field>
            <Field label="Adresse" full>
              <input
                value={form.address ?? ""}
                onChange={(e) => set({ address: e.target.value })}
                className={inputCls}
                placeholder="12 rue des Lilas, 75000 Paris"
              />
            </Field>
            <Field label="Notes" full>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => set({ notes: e.target.value })}
                className={`${inputCls} min-h-20`}
                placeholder="Informations utiles…"
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-orange-400 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aucun contact. Créez votre premier client avec « Nouveau contact ».
          </p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/artisan/contacts/${c.id}`} className="min-w-0 flex-1 group">
                  <p className="truncate font-medium text-white group-hover:text-orange-300">
                    {c.fullName}
                    {c.company && <span className="text-slate-500"> · {c.company}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    {c.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={11} /> {c.email}
                      </span>
                    )}
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} /> {c.phone}
                      </span>
                    )}
                    {c.address && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 size={11} /> {c.address}
                      </span>
                    )}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  disabled={busyId === c.id}
                  className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-400 hover:border-red-500/40 hover:text-red-300 disabled:opacity-50"
                  aria-label="Supprimer"
                >
                  {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
