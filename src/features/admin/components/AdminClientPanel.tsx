"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Plus,
  Users,
} from "lucide-react";

import {
  AdminAireFields,
  aireDraftToPayload,
  type AireDraft,
} from "@/features/admin/components/AdminAireFields";
import { AdminClientAiresEditor } from "@/features/admin/components/AdminClientAiresEditor";
import { emptyAireDraft } from "@/lib/admin/client-aire-schema";
import type { AdminClientAireRecord } from "@/lib/admin/client-aire-schema";
import { ORG_MODULE_CATALOG } from "@/lib/organizations/module-catalog";
import { ORG_MODULE_NAMES } from "@/lib/organizations/types";

type ClientRow = {
  id: string;
  name: string;
  managerFirstName: string | null;
  managerLastName: string | null;
  managerEmail: string | null;
  businessSector: string | null;
  createdAt: string;
  enabledModules: string[];
  aires: AdminClientAireRecord[];
};

type CreateResult = {
  organizationId: string;
  managerEmail: string;
  enabledModules: string[];
};

const BUSINESS_SECTOR_SUGGESTIONS = [
  "Station-service",
  "Distribution carburants",
  "Commerce de détail",
  "Restauration",
  "Industrie",
  "Services B2B",
  "Santé",
  "Immobilier",
  "Transport & logistique",
];

const moduleLabel = (id: string) =>
  ORG_MODULE_CATALOG.find((m) => m.id === id)?.label ?? id;

export function AdminClientPanel() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [businessSector, setBusinessSector] = useState("");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [aireCount, setAireCount] = useState(1);
  const [aireDrafts, setAireDrafts] = useState<AireDraft[]>([emptyAireDraft(1)]);

  const hasRegiaire = selectedModules.has(ORG_MODULE_NAMES.REGIAIRE_CORE);

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setClients(data.clients ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (hasRegiaire && aireDrafts.length === 0) {
      setAireCount(1);
      setAireDrafts([emptyAireDraft(1)]);
    }
  }, [hasRegiaire, aireDrafts.length]);

  const toggleModule = (moduleId: string) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const handleAireCountChange = (raw: number) => {
    const count = Math.max(1, Math.min(20, Number.isFinite(raw) ? raw : 1));
    setAireCount(count);
    setAireDrafts((prev) => {
      if (prev.length === count) return prev;
      if (prev.length < count) {
        return [
          ...prev,
          ...Array.from({ length: count - prev.length }, (_, i) =>
            emptyAireDraft(prev.length + i + 1)
          ),
        ];
      }
      return prev.slice(0, count);
    });
  };

  const updateAireDraft = (index: number, draft: AireDraft) => {
    setAireDrafts((prev) => prev.map((d, i) => (i === index ? draft : d)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    let airesPayload: ReturnType<typeof aireDraftToPayload>[] = [];
    if (hasRegiaire) {
      airesPayload = aireDrafts.map(aireDraftToPayload);
      if (airesPayload.some((p) => p === null)) {
        setError(
          "Chaque aire doit avoir un nom et une adresse validée (sélection dans la liste)."
        );
        setIsSubmitting(false);
        return;
      }
    }

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
          moduleNames: Array.from(selectedModules),
          aires: hasRegiaire ? airesPayload : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

      setSuccess(data.client as CreateResult);
      setCompanyName("");
      setManagerFirstName("");
      setManagerLastName("");
      setManagerEmail("");
      setBusinessSector("");
      setSelectedModules(new Set());
      setAireCount(1);
      setAireDrafts([emptyAireDraft(1)]);
      await loadClients();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur création");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl font-extrabold uppercase italic tracking-tighter text-white">
          Gestion des clients
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Créez une organisation, le compte du responsable, activez les modules et
          configurez les aires RégiAire.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 space-y-8"
      >
        <div className="flex items-center gap-2 text-violet-400">
          <Plus size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">
            Nouveau client
          </h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Nom de l'entreprise *">
            <input
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
              placeholder="Ex. Station Total Les Oliviers"
            />
          </Field>

          <Field label="Métier / secteur *">
            <input
              required
              list="business-sectors"
              value={businessSector}
              onChange={(e) => setBusinessSector(e.target.value)}
              className={inputClass}
              placeholder="Ex. Station-service"
            />
            <datalist id="business-sectors">
              {BUSINESS_SECTOR_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          <Field label="Prénom du responsable *">
            <input
              required
              value={managerFirstName}
              onChange={(e) => setManagerFirstName(e.target.value)}
              className={inputClass}
              placeholder="Jean"
            />
          </Field>

          <Field label="Nom du responsable *">
            <input
              required
              value={managerLastName}
              onChange={(e) => setManagerLastName(e.target.value)}
              className={inputClass}
              placeholder="Dupont"
            />
          </Field>

          <Field label="Email du responsable (connexion) *" className="md:col-span-2">
            <input
              required
              type="email"
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              className={inputClass}
              placeholder="jean.dupont@entreprise.fr"
            />
          </Field>
        </div>

        <div>
          <p className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Modules activés
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {ORG_MODULE_CATALOG.map((mod) => {
              const checked = selectedModules.has(mod.id);
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
                    onChange={() => toggleModule(mod.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {mod.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {mod.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {hasRegiaire && (
          <div className="space-y-4 rounded-xl border border-violet-500/20 bg-violet-600/5 p-6">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Nombre d'aires de service *" className="w-40">
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={aireCount}
                  onChange={(e) =>
                    handleAireCountChange(parseInt(e.target.value, 10))
                  }
                  className={inputClass}
                />
              </Field>
              <p className="pb-3 text-xs text-slate-400">
                Renseignez l&apos;adresse de chaque aire (météo, Bison Futé).
              </p>
            </div>

            <div className="space-y-4">
              {aireDrafts.map((draft, index) => (
                <AdminAireFields
                  key={`create-aire-${index}`}
                  index={index}
                  aire={draft}
                  onChange={(next) => updateAireDraft(index, next)}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {success && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200 space-y-2">
            <p className="flex items-center gap-2 font-semibold text-emerald-300">
              <CheckCircle2 size={16} />
              Client créé avec succès
            </p>
            <p>
              Email : <strong>{success.managerEmail}</strong>
            </p>
            <p className="text-xs text-emerald-400/80">
              Un email d&apos;invitation a été envoyé à cette adresse avec un
              lien de connexion sécurisé.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Building2 size={16} />
          )}
          Créer le client
        </button>
      </form>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8">
        <div className="mb-6 flex items-center gap-2 text-slate-300">
          <Users size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">
            Clients existants
          </h3>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Chargement…
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun client pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => {
              const clientHasRegiaire = client.enabledModules.includes(
                ORG_MODULE_NAMES.REGIAIRE_CORE
              );
              const isExpanded = expandedClientId === client.id;

              return (
                <article
                  key={client.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden"
                >
                  <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-start">
                    <div>
                      <p className="font-semibold text-white">{client.name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {[client.managerFirstName, client.managerLastName]
                          .filter(Boolean)
                          .join(" ") || "—"}{" "}
                        · {client.managerEmail ?? "—"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {client.businessSector ?? "—"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {client.enabledModules.length === 0 ? (
                          <span className="text-slate-600 text-xs">Aucun module</span>
                        ) : (
                          client.enabledModules.map((m) => (
                            <span
                              key={m}
                              className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300"
                            >
                              {moduleLabel(m)}
                            </span>
                          ))
                        )}
                        {clientHasRegiaire && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                            <MapPin size={10} />
                            {client.aires.length} aire
                            {client.aires.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {clientHasRegiaire && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedClientId(isExpanded ? null : client.id)
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-violet-500/40 hover:text-violet-300"
                      >
                        {isExpanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                        Gérer les aires
                      </button>
                    )}
                  </div>

                  {isExpanded && clientHasRegiaire && (
                    <div className="border-t border-slate-800 px-5 pb-5">
                      <AdminClientAiresEditor
                        organizationId={client.id}
                        initialAires={client.aires}
                        onSaved={() => void loadClients()}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
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
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 placeholder:text-slate-600";
