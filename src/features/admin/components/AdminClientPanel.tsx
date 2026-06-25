// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Network,
  Plus,
  Puzzle,
  Trash2,
  UserPlus,
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
  tempPassword?: string;
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

type AccountRole =
  | "direction_france"
  | "directeur_region"
  | "chef_secteur"
  | "gerant";

const ACCOUNT_ROLE_OPTIONS: { id: AccountRole; label: string; hint: string }[] = [
  {
    id: "direction_france",
    label: "Direction France",
    hint: "Crée une nouvelle enseigne (organisation) + le compte au sommet.",
  },
  {
    id: "directeur_region",
    label: "Directeur régional",
    hint: "Supervise plusieurs chefs de secteur d'une enseigne existante.",
  },
  {
    id: "chef_secteur",
    label: "Chef de secteur",
    hint: "Possède un secteur (groupe d'aires) sous un directeur régional.",
  },
  {
    id: "gerant",
    label: "Gérant",
    hint: "Exploite les aires d'un secteur, sous un chef de secteur.",
  },
];

type HierarchyData = {
  regionals: { userId: string; name: string }[];
  chefs: {
    userId: string;
    name: string;
    secteurId: string | null;
    secteurName: string | null;
  }[];
  aires: { id: string; name: string; city: string | null; secteurId: string | null }[];
};

export function AdminClientPanel() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [modulesClientId, setModulesClientId] = useState<string | null>(null);
  const [modulesDraft, setModulesDraft] = useState<Set<string>>(new Set());
  const [isSavingModules, setIsSavingModules] = useState(false);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [accountRole, setAccountRole] = useState<AccountRole>("direction_france");
  const [companyName, setCompanyName] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [businessSector, setBusinessSector] = useState("");
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [aireCount, setAireCount] = useState(1);
  const [aireDrafts, setAireDrafts] = useState<AireDraft[]>([emptyAireDraft(1)]);

  // Hiérarchie (rôles autres que Direction France)
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [hierarchy, setHierarchy] = useState<HierarchyData | null>(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [parentRegionalUserId, setParentRegionalUserId] = useState("");
  const [parentChefUserId, setParentChefUserId] = useState("");
  const [secteurName, setSecteurName] = useState("");
  const [selectedAireIds, setSelectedAireIds] = useState<Set<string>>(new Set());
  const [identityFirstName, setIdentityFirstName] = useState("");
  const [identityLastName, setIdentityLastName] = useState("");
  const [identityEmail, setIdentityEmail] = useState("");
  const [identityPhone, setIdentityPhone] = useState("");

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

  // Charge la hiérarchie de l'org sélectionnée (régionaux, chefs, aires)
  useEffect(() => {
    if (accountRole === "direction_france" || !selectedOrgId) {
      setHierarchy(null);
      return;
    }
    let cancelled = false;
    setHierarchyLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/accounts?orgId=${selectedOrgId}`);
        const data = await res.json();
        if (!cancelled && res.ok) setHierarchy(data as HierarchyData);
      } finally {
        if (!cancelled) setHierarchyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountRole, selectedOrgId]);

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

  const openModulesEditor = (client: ClientRow) => {
    setModulesClientId(client.id);
    setModulesDraft(new Set(client.enabledModules));
    setModulesError(null);
  };

  const handleSaveModules = async (organizationId: string) => {
    setIsSavingModules(true);
    setModulesError(null);
    try {
      const res = await fetch(`/api/admin/clients/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleNames: Array.from(modulesDraft) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setModulesClientId(null);
      await loadClients();
    } catch (e) {
      setModulesError(e instanceof Error ? e.message : "Erreur sauvegarde");
    } finally {
      setIsSavingModules(false);
    }
  };

  const handleDelete = async (organizationId: string) => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/clients/${organizationId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setDeleteConfirmId(null);
      if (expandedClientId === organizationId) setExpandedClientId(null);
      await loadClients();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erreur suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  const resetIdentity = () => {
    setIdentityFirstName("");
    setIdentityLastName("");
    setIdentityEmail("");
    setIdentityPhone("");
    setParentRegionalUserId("");
    setParentChefUserId("");
    setSecteurName("");
    setSelectedAireIds(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (accountRole === "direction_france") {
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
            moduleNames: Array.from(selectedModules),
            aires: hasRegiaire ? airesPayload : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

        setSuccess({
          organizationId: data.account.organizationId,
          managerEmail: data.account.email,
          enabledModules: Array.from(selectedModules),
          tempPassword: data.account.tempPassword,
        });
        setCompanyName("");
        setManagerFirstName("");
        setManagerLastName("");
        setManagerEmail("");
        setBusinessSector("");
        setSelectedModules(new Set());
        setAireCount(1);
        setAireDrafts([emptyAireDraft(1)]);
        await loadClients();
        return;
      }

      // Rôles hiérarchie : rattachement à une org existante
      if (!selectedOrgId) {
        setError("Sélectionnez une enseigne (organisation).");
        setIsSubmitting(false);
        return;
      }

      const identity = {
        firstName: identityFirstName,
        lastName: identityLastName,
        email: identityEmail,
        phone: identityPhone || null,
      };

      let payload: Record<string, unknown>;
      if (accountRole === "directeur_region") {
        payload = { role: "directeur_region", organizationId: selectedOrgId, ...identity };
      } else if (accountRole === "chef_secteur") {
        if (!parentRegionalUserId) {
          setError("Sélectionnez le directeur régional parent.");
          setIsSubmitting(false);
          return;
        }
        payload = {
          role: "chef_secteur",
          organizationId: selectedOrgId,
          parentRegionalUserId,
          secteurName,
          aireIds: Array.from(selectedAireIds),
          ...identity,
        };
      } else {
        if (!parentChefUserId) {
          setError("Sélectionnez le chef de secteur parent.");
          setIsSubmitting(false);
          return;
        }
        payload = {
          role: "gerant",
          organizationId: selectedOrgId,
          parentChefUserId,
          aireIds: Array.from(selectedAireIds),
          ...identity,
        };
      }

      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);

      setSuccess({
        organizationId: selectedOrgId,
        managerEmail: data.account.email,
        enabledModules: [],
        tempPassword: data.account.tempPassword,
      });
      resetIdentity();
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
          Gestion des comptes
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Créez une enseigne (Direction France) puis sa hiérarchie : directeurs
          régionaux, chefs de secteur et gérants.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 space-y-8"
      >
        <div className="flex items-center gap-2 text-violet-400">
          <Plus size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">
            Nouveau compte
          </h3>
        </div>

        {/* Sélecteur de rôle */}
        <div>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Type de compte
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ACCOUNT_ROLE_OPTIONS.map((opt) => {
              const active = accountRole === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setAccountRole(opt.id);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    active
                      ? "border-violet-500/60 bg-violet-600/10"
                      : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                  }`}
                >
                  <span
                    className={`block text-sm font-bold ${active ? "text-violet-200" : "text-white"}`}
                  >
                    {opt.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-slate-500">
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sélecteur d'enseigne pour les rôles hiérarchie */}
        {accountRole !== "direction_france" && (
          <Field label="Enseigne (organisation) *">
            <select
              required
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setParentRegionalUserId("");
                setParentChefUserId("");
                setSelectedAireIds(new Set());
              }}
              className={inputClass}
            >
              <option value="">— Choisir une enseigne —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {accountRole === "direction_france" && (
        <>
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
        </>
        )}

        {/* Champs hiérarchie (rôles autres que Direction France) */}
        {accountRole !== "direction_france" && selectedOrgId && (
          <div className="space-y-6">
            {hierarchyLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Chargement de
                l&apos;enseigne…
              </div>
            ) : (
              <>
                {/* Parent : directeur régional (pour chef de secteur) */}
                {accountRole === "chef_secteur" && (
                  <Field label="Directeur régional parent *">
                    <select
                      required
                      value={parentRegionalUserId}
                      onChange={(e) => setParentRegionalUserId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">— Choisir —</option>
                      {(hierarchy?.regionals ?? []).map((r) => (
                        <option key={r.userId} value={r.userId}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    {(hierarchy?.regionals ?? []).length === 0 && (
                      <span className="mt-1 block text-[11px] text-amber-400/80">
                        Aucun directeur régional dans cette enseigne — créez-en un
                        d&apos;abord.
                      </span>
                    )}
                  </Field>
                )}

                {/* Parent : chef de secteur (pour gérant) */}
                {accountRole === "gerant" && (
                  <Field label="Chef de secteur parent *">
                    <select
                      required
                      value={parentChefUserId}
                      onChange={(e) => {
                        setParentChefUserId(e.target.value);
                        setSelectedAireIds(new Set());
                      }}
                      className={inputClass}
                    >
                      <option value="">— Choisir —</option>
                      {(hierarchy?.chefs ?? []).map((c) => (
                        <option key={c.userId} value={c.userId}>
                          {c.name}
                          {c.secteurName ? ` · ${c.secteurName}` : ""}
                        </option>
                      ))}
                    </select>
                    {(hierarchy?.chefs ?? []).length === 0 && (
                      <span className="mt-1 block text-[11px] text-amber-400/80">
                        Aucun chef de secteur dans cette enseigne — créez-en un
                        d&apos;abord.
                      </span>
                    )}
                  </Field>
                )}

                {/* Aires exploitées (pour gérant) — limitées au secteur du chef parent */}
                {accountRole === "gerant" && parentChefUserId && (() => {
                  const chef = (hierarchy?.chefs ?? []).find(
                    (c) => c.userId === parentChefUserId
                  );
                  const secteurAires = (hierarchy?.aires ?? []).filter(
                    (a) => chef?.secteurId && a.secteurId === chef.secteurId
                  );
                  return (
                    <div>
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Aires exploitées par ce gérant
                      </p>
                      {secteurAires.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Le secteur de ce chef n&apos;a aucune aire rattachée.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {secteurAires.map((aire) => {
                            const checked = selectedAireIds.has(aire.id);
                            return (
                              <label
                                key={aire.id}
                                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
                                  checked
                                    ? "border-violet-500/50 bg-violet-600/10 text-violet-200"
                                    : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedAireIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(aire.id)) next.delete(aire.id);
                                      else next.add(aire.id);
                                      return next;
                                    });
                                  }}
                                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-violet-600"
                                />
                                <MapPin
                                  size={12}
                                  className={checked ? "text-violet-400" : "text-slate-600"}
                                />
                                <span className="truncate font-medium">{aire.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Secteur + aires (pour chef de secteur) */}
                {accountRole === "chef_secteur" && (
                  <>
                    <Field label="Nom du secteur *">
                      <input
                        required
                        value={secteurName}
                        onChange={(e) => setSecteurName(e.target.value)}
                        className={inputClass}
                        placeholder="Ex. Secteur Sud-Ouest"
                      />
                    </Field>
                    <div>
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Aires rattachées au secteur
                      </p>
                      {(hierarchy?.aires ?? []).length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Aucune aire dans cette enseigne.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(hierarchy?.aires ?? []).map((aire) => {
                            const checked = selectedAireIds.has(aire.id);
                            const takenByOther = aire.secteurId !== null;
                            return (
                              <label
                                key={aire.id}
                                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
                                  checked
                                    ? "border-violet-500/50 bg-violet-600/10 text-violet-200"
                                    : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelectedAireIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(aire.id)) next.delete(aire.id);
                                      else next.add(aire.id);
                                      return next;
                                    });
                                  }}
                                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-violet-600"
                                />
                                <MapPin
                                  size={12}
                                  className={checked ? "text-violet-400" : "text-slate-600"}
                                />
                                <span className="truncate font-medium">{aire.name}</span>
                                {takenByOther && !checked && (
                                  <span className="ml-auto shrink-0 text-[9px] uppercase text-amber-400/70">
                                    déjà attribuée
                                  </span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Identité du compte */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Field label="Prénom *">
                    <input
                      required
                      value={identityFirstName}
                      onChange={(e) => setIdentityFirstName(e.target.value)}
                      className={inputClass}
                      placeholder="Marie"
                    />
                  </Field>
                  <Field label="Nom *">
                    <input
                      required
                      value={identityLastName}
                      onChange={(e) => setIdentityLastName(e.target.value)}
                      className={inputClass}
                      placeholder="Dupont"
                    />
                  </Field>
                  <Field label="Email (connexion) *">
                    <input
                      required
                      type="email"
                      value={identityEmail}
                      onChange={(e) => setIdentityEmail(e.target.value)}
                      className={inputClass}
                      placeholder="marie.dupont@enseigne.fr"
                    />
                  </Field>
                  <Field label="Téléphone">
                    <input
                      type="tel"
                      value={identityPhone}
                      onChange={(e) => setIdentityPhone(e.target.value)}
                      className={inputClass}
                      placeholder="06 12 34 56 78"
                    />
                  </Field>
                </div>
              </>
            )}
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
              Compte créé avec succès
            </p>
            <p>
              Email : <strong>{success.managerEmail}</strong>
            </p>
            {success.tempPassword ? (
              <div className="space-y-1">
                <p>
                  Mot de passe provisoire :{" "}
                  <strong className="font-mono text-white">
                    {success.tempPassword}
                  </strong>
                </p>
                <p className="text-xs text-amber-300/90">
                  Mode sans email actif — communiquez ces identifiants
                  manuellement. À désactiver avant la prod.
                </p>
              </div>
            ) : (
              <p className="text-xs text-emerald-400/80">
                Un email d&apos;invitation a été envoyé à cette adresse avec un
                lien de connexion sécurisé.
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : accountRole === "direction_france" ? (
            <Building2 size={16} />
          ) : accountRole === "directeur_region" || accountRole === "chef_secteur" ? (
            <Network size={16} />
          ) : (
            <UserPlus size={16} />
          )}
          {accountRole === "direction_france"
            ? "Créer l'enseigne"
            : `Créer le compte ${ACCOUNT_ROLE_OPTIONS.find((o) => o.id === accountRole)?.label.toLowerCase()}`}
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

                    <div className="flex flex-wrap items-center gap-2">
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
                          Aires
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openModulesEditor(client)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-violet-500/40 hover:text-violet-300"
                      >
                        <Puzzle size={14} />
                        Modules
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmId(client.id);
                          setDeleteError(null);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-800/50 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-red-400 hover:border-red-500/60 hover:text-red-300"
                      >
                        <Trash2 size={14} />
                        Supprimer
                      </button>
                    </div>
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

      {modulesClientId !== null && (() => {
        const target = clients.find((c) => c.id === modulesClientId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
              <div className="mb-4 flex items-center gap-3 text-violet-400">
                <Puzzle size={20} />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Modules — {target?.name}
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {ORG_MODULE_CATALOG.map((mod) => {
                  const checked = modulesDraft.has(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                        checked
                          ? "border-violet-500/50 bg-violet-600/10"
                          : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setModulesDraft((prev) => {
                            const next = new Set(prev);
                            if (next.has(mod.id)) next.delete(mod.id);
                            else next.add(mod.id);
                            return next;
                          });
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-600 focus:ring-violet-500"
                      />
                      <span>
                        <span className="block text-xs font-semibold text-white">{mod.label}</span>
                        <span className="mt-0.5 block text-[10px] text-slate-500">{mod.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {modulesError && (
                <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {modulesError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setModulesClientId(null); setModulesError(null); }}
                  disabled={isSavingModules}
                  className="rounded-xl border border-slate-700 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-slate-600 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveModules(modulesClientId)}
                  disabled={isSavingModules}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {isSavingModules ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {deleteConfirmId !== null && (() => {
        const target = clients.find((c) => c.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-red-500/30 bg-slate-900 p-8 shadow-2xl">
              <div className="mb-4 flex items-center gap-3 text-red-400">
                <AlertTriangle size={22} />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Supprimer le client
                </h3>
              </div>
              <p className="text-sm text-slate-300">
                Vous êtes sur le point de supprimer{" "}
                <strong className="text-white">{target?.name ?? "ce client"}</strong>{" "}
                et toutes ses données (aires, livraisons, modules, compte utilisateur).
              </p>
              <p className="mt-2 text-xs text-red-400/80">
                Cette action est irréversible.
              </p>
              {deleteError && (
                <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {deleteError}
                </p>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setDeleteConfirmId(null); setDeleteError(null); }}
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
                  {isDeleting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Supprimer définitivement
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
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-violet-500 placeholder:text-slate-600";
