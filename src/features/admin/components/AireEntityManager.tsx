// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, MapPin, Plus, Save, Trash2 } from "lucide-react";

import {
  AdminAireFields,
  aireDraftToPayload,
  recordToDraft,
  type AireDraft,
} from "@/features/admin/components/AdminAireFields";
import { emptyAireDraft } from "@/lib/admin/client-aire-schema";
import type { AdminClientAireRecord } from "@/lib/admin/client-aire-schema";
import { ORG_MODULE_CATALOG } from "@/lib/organizations/module-catalog";

const VERTICAL_MODULES = ["regiaire_core", "hotel_core", "artisan_core"];
const TRANSVERSE_MODULES = ORG_MODULE_CATALOG.filter(
  (m) => !VERTICAL_MODULES.includes(m.id)
);

type ClientRow = { id: string; enabledModules: string[]; aires: AdminClientAireRecord[] };

export function AireEntityManager({ organizationId }: { organizationId: string }) {
  const [drafts, setDrafts] = useState<AireDraft[]>([]);
  const [modulesByAire, setModulesByAire] = useState<Record<string, string[]>>({});
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingModAireId, setSavingModAireId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [clientsRes, modulesRes] = await Promise.all([
        fetch("/api/admin/clients"),
        fetch(`/api/admin/aire-modules?orgId=${organizationId}`),
      ]);
      const clientsData = await clientsRes.json();
      if (!clientsRes.ok) throw new Error(clientsData.error ?? `Erreur ${clientsRes.status}`);

      const org = (clientsData.clients ?? []).find((c: ClientRow) => c.id === organizationId);
      setDrafts((org?.aires ?? []).map(recordToDraft));

      if (modulesRes.ok) {
        const modulesData = await modulesRes.json();
        const map: Record<string, string[]> = {};
        for (const a of modulesData.aires ?? []) map[a.id] = a.modules;
        setModulesByAire(map);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur chargement");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = (index: number, draft: AireDraft) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? draft : d)));
  };

  const addAire = () => {
    setDrafts((prev) => {
      setOpenIndex(prev.length);
      return [...prev, emptyAireDraft(prev.length + 1)];
    });
  };

  const removeAire = (index: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
    setOpenIndex(null);
  };

  const handleSaveAires = async () => {
    setError(null);
    setSuccess(null);
    const payloads = drafts.map(aireDraftToPayload);
    if (drafts.length > 0 && payloads.some((p) => p === null)) {
      setError("Chaque aire doit avoir un nom et une adresse validée (sélection dans la liste).");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/clients/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aires: payloads.filter((p): p is NonNullable<typeof p> => p !== null),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      setSuccess("Aires enregistrées.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleModule = async (aireId: string, moduleId: string) => {
    const current = modulesByAire[aireId] ?? [];
    const next = current.includes(moduleId)
      ? current.filter((m) => m !== moduleId)
      : [...current, moduleId];
    setModulesByAire((prev) => ({ ...prev, [aireId]: next }));
    setSavingModAireId(aireId);
    try {
      const res = await fetch("/api/admin/aire-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aireId, moduleNames: next }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur enregistrement module");
      await load();
    } finally {
      setSavingModAireId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-8">
      <div className="mb-6 flex items-center gap-2 text-slate-300">
        <MapPin size={18} />
        <h3 className="text-sm font-black uppercase tracking-wider">Aires de l&apos;entité</h3>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.length === 0 && (
            <p className="text-sm text-slate-500">Aucune aire — ajoutez-en une.</p>
          )}
          {drafts.map((draft, index) => {
            const isOpen = openIndex === index;
            const aireId = draft.id ?? null;
            const modules = aireId ? modulesByAire[aireId] ?? [] : [];
            return (
              <div
                key={draft.id ?? `new-${index}`}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <MapPin size={16} className="text-amber-400" />
                    <span className="font-medium text-white">
                      {draft.name.trim() || `Aire ${index + 1}`}
                    </span>
                    {aireId && modules.length > 0 && (
                      <span className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-300">
                        {modules.length} module{modules.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronDown size={18} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={18} className="text-slate-500" />
                  )}
                </button>

                {isOpen && (
                  <div className="space-y-6 border-t border-slate-800 p-5">
                    <AdminAireFields
                      index={index}
                      aire={draft}
                      onChange={(next) => updateDraft(index, next)}
                      showOrderDays={false}
                      showHeader={false}
                    />

                    <div>
                      <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        Modules transverses
                        {savingModAireId === aireId && (
                          <Loader2 size={12} className="animate-spin" />
                        )}
                      </p>
                      {aireId ? (
                        <div className="flex flex-wrap gap-2">
                          {TRANSVERSE_MODULES.map((mod) => {
                            const checked = modules.includes(mod.id);
                            return (
                              <button
                                key={mod.id}
                                type="button"
                                onClick={() => void toggleModule(aireId, mod.id)}
                                disabled={savingModAireId === aireId}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-60 ${
                                  checked
                                    ? "border-violet-500/50 bg-violet-600/15 text-violet-200"
                                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                                }`}
                              >
                                {checked && <Check size={12} />}
                                {mod.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-400/80">
                          Enregistrez l&apos;aire pour pouvoir attribuer ses modules.
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAire(index)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-[10px] font-bold uppercase text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 size={12} />
                      Retirer l&apos;aire
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={addAire}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-violet-500/40"
        >
          <Plus size={14} />
          Ajouter une aire
        </button>
        <button
          type="button"
          onClick={() => void handleSaveAires()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
        >
          {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer les aires
        </button>
      </div>
    </section>
  );
}
