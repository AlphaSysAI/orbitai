// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MapPin,
  Network,
  Plus,
  UserPlus,
} from "lucide-react";

import type { AdminClientAireRecord } from "@/lib/admin/client-aire-schema";
import { ORG_MODULE_NAMES } from "@/lib/organizations/types";

type ClientRow = {
  id: string;
  name: string;
  enabledModules: string[];
  aires: AdminClientAireRecord[];
};

type CreateResult = {
  managerEmail: string;
  tempPassword?: string;
};

type HierarchyRole = "directeur_region" | "chef_secteur" | "gerant";

const ROLE_OPTIONS: { id: HierarchyRole; label: string; hint: string }[] = [
  {
    id: "directeur_region",
    label: "Directeur régional",
    hint: "Supervise plusieurs chefs de secteur de l'enseigne.",
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

export function OrbitAireAdminPanel({ lockedOrgId }: { lockedOrgId?: string } = {}) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateResult | null>(null);
  const [accountRole, setAccountRole] = useState<HierarchyRole>("directeur_region");
  const [selectedOrgId, setSelectedOrgId] = useState(lockedOrgId ?? "");
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

  const loadClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      // Seules les enseignes ayant le module Orbit Aire sont pilotables ici.
      const rows: ClientRow[] = (data.clients ?? []).filter((c: ClientRow) =>
        c.enabledModules.includes(ORG_MODULE_NAMES.REGIAIRE_CORE)
      );
      setClients(rows);
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
    if (!selectedOrgId) {
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
  }, [selectedOrgId]);

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

  const toggleAire = (aireId: string) => {
    setSelectedAireIds((prev) => {
      const next = new Set(prev);
      if (next.has(aireId)) next.delete(aireId);
      else next.add(aireId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
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

      setSuccess({ managerEmail: data.account.email, tempPassword: data.account.tempPassword });
      resetIdentity();
      await loadClients();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedChef = (hierarchy?.chefs ?? []).find((c) => c.userId === parentChefUserId);
  const gerantAires = (hierarchy?.aires ?? []).filter(
    (a) => selectedChef?.secteurId && a.secteurId === selectedChef.secteurId
  );

  return (
    <div className="space-y-10">
      {!lockedOrgId && (
        <div>
          <h2 className="text-3xl font-extrabold uppercase italic tracking-tighter text-white">
            Administration Orbit Aire
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Hiérarchie d&apos;enseigne (directeurs régionaux, chefs de secteur, gérants) et
            gestion des aires de service. Réservé aux enseignes ayant le module Orbit Aire.
          </p>
        </div>
      )}

      {/* ─── Création de compte hiérarchie ─── */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8 space-y-8"
      >
        <div className="flex items-center gap-2 text-violet-400">
          <Plus size={18} />
          <h3 className="text-sm font-black uppercase tracking-wider">Nouveau compte hiérarchie</h3>
        </div>

        <div>
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Type de compte
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {ROLE_OPTIONS.map((opt) => {
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
                  <span className={`block text-sm font-bold ${active ? "text-violet-200" : "text-white"}`}>
                    {opt.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-slate-500">{opt.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!lockedOrgId && (
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
            {clients.length === 0 && !isLoading && (
              <span className="mt-1 block text-[11px] text-amber-400/80">
                Aucune enseigne avec le module Orbit Aire — activez-le dans « Clients ».
              </span>
            )}
          </Field>
        )}

        {selectedOrgId && (
          <div className="space-y-6">
            {hierarchyLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Chargement de l&apos;enseigne…
              </div>
            ) : (
              <>
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
                        Aucun directeur régional dans cette enseigne — créez-en un d&apos;abord.
                      </span>
                    )}
                  </Field>
                )}

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
                        Aucun chef de secteur dans cette enseigne — créez-en un d&apos;abord.
                      </span>
                    )}
                  </Field>
                )}

                {accountRole === "gerant" && parentChefUserId && (
                  <div>
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      Aires exploitées par ce gérant
                    </p>
                    {gerantAires.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        Le secteur de ce chef n&apos;a aucune aire rattachée.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {gerantAires.map((aire) => (
                          <AireCheckbox
                            key={aire.id}
                            label={aire.name}
                            checked={selectedAireIds.has(aire.id)}
                            onToggle={() => toggleAire(aire.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

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
                        <p className="text-xs text-slate-500">Aucune aire dans cette enseigne.</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {(hierarchy?.aires ?? []).map((aire) => (
                            <AireCheckbox
                              key={aire.id}
                              label={aire.name}
                              checked={selectedAireIds.has(aire.id)}
                              takenByOther={aire.secteurId !== null}
                              onToggle={() => toggleAire(aire.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

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
                  <strong className="font-mono text-white">{success.tempPassword}</strong>
                </p>
                <p className="text-xs text-amber-300/90">
                  Mode sans email actif — communiquez ces identifiants manuellement. À désactiver
                  avant la prod.
                </p>
              </div>
            ) : (
              <p className="text-xs text-emerald-400/80">
                Un email d&apos;invitation a été envoyé à cette adresse.
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
          ) : accountRole === "gerant" ? (
            <UserPlus size={16} />
          ) : (
            <Network size={16} />
          )}
          Créer le compte {ROLE_OPTIONS.find((o) => o.id === accountRole)?.label.toLowerCase()}
        </button>
      </form>
    </div>
  );
}

function AireCheckbox({
  label,
  checked,
  takenByOther = false,
  onToggle,
}: {
  label: string;
  checked: boolean;
  takenByOther?: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
        checked
          ? "border-violet-500/50 bg-violet-600/10 text-violet-200"
          : "border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-700"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-violet-600"
      />
      <MapPin size={12} className={checked ? "text-violet-400" : "text-slate-600"} />
      <span className="truncate font-medium">{label}</span>
      {takenByOther && !checked && (
        <span className="ml-auto shrink-0 text-[9px] uppercase text-amber-400/70">déjà attribuée</span>
      )}
    </label>
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
