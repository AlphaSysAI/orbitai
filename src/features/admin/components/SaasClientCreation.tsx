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
import {
  FEATURE_BY_ID,
  featuresByGroup,
  umbrellaModuleFor,
  type FeatureDef,
  type FeatureGroup,
} from "@/lib/organizations/feature-catalog";

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

/** Label lisible d'un module_name (feature vendable ; ignore les parapluies). */
const featureLabel = (id: string) => FEATURE_BY_ID[id]?.label ?? id;

export function SaasClientCreation({
  group,
  verticalLabel,
  sectorPlaceholder = "Ex. Station-service",
  manageBasePath,
  entityNoun = "organisation",
}: {
  /** Groupe de features proposées à la création (aire / hotel). */
  group: FeatureGroup;
  verticalLabel: string;
  sectorPlaceholder?: string;
  /** Si défini, chaque entité affiche un bouton « Administration » → `{base}/{id}`. */
  manageBasePath?: string;
  /** Mot féminin employé dans les libellés (« organisation », « entité »…). */
  entityNoun?: string;
}) {
  // Features proposées : le vertical choisi + les add-ons IA transverses.
  const verticalFeatures = featuresByGroup(group);
  const addonFeatures = featuresByGroup("addon");
  const offeredFeatures: FeatureDef[] = [...verticalFeatures, ...addonFeatures];
  const umbrella = umbrellaModuleFor(verticalFeatures[0]?.id ?? "");

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [businessSector, setBusinessSector] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(
    new Set(verticalFeatures.map((f) => f.id))
  );

  const belongsToGroup = useCallback(
    (c: ClientRow) =>
      c.enabledModules.some(
        (m) => FEATURE_BY_ID[m]?.group === group || (umbrella && m === umbrella)
      ),
    [group, umbrella]
  );

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (res.ok) {
        setClients((data.clients ?? []).filter(belongsToGroup));
      }
    } finally {
      setIsLoading(false);
    }
  }, [belongsToGroup]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const toggleFeatureSelection = (id: string) => {
    setSelectedFeatures((prev) => {
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
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          managerFirstName,
          managerLastName,
          managerEmail,
          businessSector,
          featureIds: Array.from(selectedFeatures),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setSuccess({
        managerEmail: data.client.managerEmail,
        tempPassword: data.client.tempPassword,
      });
      setCompanyName("");
      setManagerFirstName("");
      setManagerLastName("");
      setManagerEmail("");
      setBusinessSector("");
      setSelectedFeatures(new Set(verticalFeatures.map((f) => f.id)));
      await loadClients();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Erreur création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleClientFeature = async (
    clientId: string,
    featureId: string,
    enabled: boolean
  ) => {
    setTogglingKey(`${clientId}:${featureId}`);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featureId, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      await loadClients();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur mise à jour feature");
    } finally {
      setTogglingKey(null);
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

        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Features activées à la création
          </p>
          <p className="mb-4 text-xs text-slate-500">
            Sélectionnez les briques <span className="font-semibold text-violet-300">{verticalLabel}</span>{" "}
            et les add-ons IA à ouvrir d&apos;office. Le client pourra ajuster son abonnement ensuite.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {offeredFeatures.map((feature) => {
              const checked = selectedFeatures.has(feature.id);
              return (
                <label
                  key={feature.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                    checked
                      ? "border-violet-500/50 bg-violet-600/10"
                      : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFeatureSelection(feature.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{feature.label}</span>
                      <span className="text-[10px] font-bold text-slate-500">{feature.priceEurMonthly} €/mois</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{feature.tagline}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

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
                className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{client.name}</p>
                    <p className="text-xs text-slate-500">
                      {[client.managerFirstName, client.managerLastName].filter(Boolean).join(" ") || "—"}
                      {" · "}
                      {client.managerEmail ?? "—"}
                    </p>
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
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
                    Features (clic pour activer / désactiver)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {offeredFeatures.map((feature) => {
                      const on = client.enabledModules.includes(feature.id);
                      const busy = togglingKey === `${client.id}:${feature.id}`;
                      return (
                        <button
                          key={feature.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleClientFeature(client.id, feature.id, !on)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${
                            on
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:border-emerald-400/60"
                              : "border-slate-700 bg-slate-900/60 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                          }`}
                        >
                          {busy && <Loader2 size={10} className="animate-spin" />}
                          {featureLabel(feature.id)}
                        </button>
                      );
                    })}
                  </div>
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
