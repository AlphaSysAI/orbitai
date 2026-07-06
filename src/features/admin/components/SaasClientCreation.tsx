// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  Settings,
  Trash2,
  Users,
} from "lucide-react";

import type { AdminClientAireRecord } from "@/lib/admin/client-aire-schema";
import { ORG_MODULE_CATALOG } from "@/lib/organizations/module-catalog";

const VERTICAL_MODULES = ["regiaire_core", "hotel_core", "artisan_core"];

/** Modules transverses (add-ons IA) — tout sauf les 3 verticaux métier. */
const TRANSVERSE_MODULES = ORG_MODULE_CATALOG.filter(
  (m) => !VERTICAL_MODULES.includes(m.id)
);

type ClientRow = {
  id: string;
  name: string;
  managerFirstName: string | null;
  managerLastName: string | null;
  managerEmail: string | null;
  businessSector: string | null;
  enabledModules: string[];
  aires: AdminClientAireRecord[];
};

type CreateResult = { managerEmail: string; tempPassword?: string };

const moduleLabel = (id: string) =>
  ORG_MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;

export function SaasClientCreation({
  vertical,
  verticalLabel,
  sectorPlaceholder = "Ex. Station-service",
  showTransverse = true,
  manageBasePath,
  entityNoun = "organisation",
}: {
  vertical: string;
  verticalLabel: string;
  sectorPlaceholder?: string;
  /** Cases add-ons IA transverses au niveau entité. Orbit Aire les gère par aire → false. */
  showTransverse?: boolean;
  /** Si défini, chaque entité affiche un bouton « Administration » → `{base}/{id}`. */
  manageBasePath?: string;
  /** Mot féminin employé dans les libellés (« organisation », « entité »…). */
  entityNoun?: string;
}) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [businessSector, setBusinessSector] = useState("");
  const [transverse, setTransverse] = useState<Set<string>>(new Set());

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (res.ok) {
        setClients(
          (data.clients ?? []).filter((c: ClientRow) =>
            c.enabledModules.includes(vertical)
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [vertical]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const toggleTransverse = (id: string) => {
    setTransverse((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "direction_france",
          companyName,
          managerFirstName,
          managerLastName,
          managerEmail,
          businessSector,
          // Module vertical forcé + éventuels add-ons IA transverses (si gérés à ce niveau).
          moduleNames: showTransverse ? [vertical, ...Array.from(transverse)] : [vertical],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setSuccess({ managerEmail: data.account.email, tempPassword: data.account.tempPassword });
      setCompanyName("");
      setManagerFirstName("");
      setManagerLastName("");
      setManagerEmail("");
      setBusinessSector("");
      setTransverse(new Set());
      await loadClients();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Erreur création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteConfirmId(null);
        await loadClients();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-8"
      >
        <div className="flex items-center gap-2 text-violet-400">
          <Building2 size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">
{`Nouvelle ${entityNoun} ${verticalLabel}`.trim()}
          </h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Nom de l'entreprise *">
            <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} placeholder="Ex. Groupe Les Oliviers" />
          </Field>
          <Field label="Métier / secteur *">
            <input required value={businessSector} onChange={(e) => setBusinessSector(e.target.value)} className={inputClass} placeholder={sectorPlaceholder} />
          </Field>
          <Field label="Prénom du responsable *">
            <input required value={managerFirstName} onChange={(e) => setManagerFirstName(e.target.value)} className={inputClass} placeholder="Jean" />
          </Field>
          <Field label="Nom du responsable *">
            <input required value={managerLastName} onChange={(e) => setManagerLastName(e.target.value)} className={inputClass} placeholder="Dupont" />
          </Field>
          <Field label="Email du responsable (connexion) *" className="md:col-span-2">
            <input required type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} className={inputClass} placeholder="jean.dupont@entreprise.fr" />
          </Field>
        </div>

        {showTransverse ? (
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Modules
            </p>
            <p className="mb-4 text-xs text-slate-500">
              <span className="font-semibold text-violet-300">{verticalLabel}</span> est activé
              d&apos;office. Ajoutez les add-ons IA transverses souhaités :
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {TRANSVERSE_MODULES.map((mod) => {
                const checked = transverse.has(mod.id);
                return (
                  <label
                    key={mod.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                      checked
                        ? "border-violet-500/50 bg-violet-600/10"
                        : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTransverse(mod.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-white">{mod.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{mod.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-xs text-slate-400">
            <span className="font-semibold text-violet-300">{verticalLabel}</span> est activé
            d&apos;office. Les add-ons IA transverses s&apos;attribuent ensuite <strong>par aire</strong>,
            depuis la fiche « Administration » de l&apos;entité.
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-emerald-300">
              <CheckCircle2 size={16} /> Client créé
            </p>
            <p>Email : <strong>{success.managerEmail}</strong></p>
            {success.tempPassword && (
              <p>
                Mot de passe provisoire :{" "}
                <strong className="font-mono text-white">{success.tempPassword}</strong>
                <span className="ml-2 text-xs text-amber-300/90">(à communiquer manuellement)</span>
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
          {`Créer l'${entityNoun}`}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8">
        <div className="mb-6 flex items-center gap-2 text-slate-300">
          <Users size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">
            {`${entityNoun}s ${verticalLabel}`.trim()}
          </h3>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-500">{`Aucune ${entityNoun} pour le moment.`}</p>
        ) : (
          <div className="space-y-3">
            {clients.map((client) => (
              <article
                key={client.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div>
                  <p className="font-semibold text-white">{client.name}</p>
                  <p className="text-xs text-slate-500">
                    {[client.managerFirstName, client.managerLastName].filter(Boolean).join(" ") || "—"}
                    {" · "}
                    {client.managerEmail ?? "—"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {client.enabledModules.map((m) => (
                      <span
                        key={m}
                        className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300"
                      >
                        {moduleLabel(m)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {manageBasePath && (
                    <Link
                      href={`${manageBasePath}/${client.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-violet-600/40 bg-violet-600/10 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-violet-300 hover:border-violet-500/60 hover:text-violet-200"
                    >
                      <Settings size={14} /> Administration
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(client.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-800/50 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-red-400 hover:border-red-500/60 hover:text-red-300"
                  >
                    <Trash2 size={14} /> Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {deleteConfirmId !== null && (() => {
        const target = clients.find((c) => c.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-4 sm:p-8 shadow-2xl">
              <div className="mb-4 flex items-center gap-3 text-red-400">
                <AlertTriangle size={22} />
                <h3 className="text-sm font-black uppercase tracking-wider">Supprimer le client</h3>
              </div>
              <p className="text-sm text-slate-300">
                Supprimer <strong className="text-white">{target?.name ?? "ce client"}</strong> et
                toutes ses données ? Cette action est irréversible.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={isDeleting}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-slate-600 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(deleteConfirmId)}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-2 ${className}`}>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 placeholder:text-slate-600";
