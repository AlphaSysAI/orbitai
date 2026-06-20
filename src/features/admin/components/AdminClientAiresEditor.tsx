"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";

import {
  AdminAireFields,
  aireDraftToPayload,
  recordToDraft,
  type AireDraft,
} from "@/features/admin/components/AdminAireFields";
import { emptyAireDraft } from "@/lib/admin/client-aire-schema";
import type { AdminClientAireRecord } from "@/lib/admin/client-aire-schema";

type AdminClientAiresEditorProps = {
  organizationId: string;
  initialAires: AdminClientAireRecord[];
  onSaved: () => void;
};

export function AdminClientAiresEditor({
  organizationId,
  initialAires,
  onSaved,
}: AdminClientAiresEditorProps) {
  const [drafts, setDrafts] = useState<AireDraft[]>(() =>
    initialAires.map(recordToDraft)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(initialAires.map(recordToDraft));
  }, [initialAires]);

  const updateDraft = (index: number, draft: AireDraft) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? draft : d)));
  };

  const addAire = () => {
    setDrafts((prev) => [...prev, emptyAireDraft(prev.length + 1)]);
  };

  const removeAire = (index: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    const payloads = drafts.map(aireDraftToPayload);
    if (drafts.length > 0 && payloads.some((p) => p === null)) {
      setError(
        "Chaque aire doit avoir un nom et une adresse validée (sélection dans la liste)."
      );
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
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-violet-500/20 bg-slate-950/40 p-5">
      <p className="text-xs text-slate-400">
        Ajoutez, modifiez ou retirez les aires de service RégiAire de ce client.
      </p>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </p>
      )}

      <div className="space-y-4">
        {drafts.map((draft, index) => (
          <AdminAireFields
            key={draft.id ?? `new-${index}`}
            index={index}
            aire={draft}
            onChange={(next) => updateDraft(index, next)}
            onRemove={() => removeAire(index)}
            canRemove
          />
        ))}
      </div>

      {drafts.length === 0 && (
        <p className="text-sm text-slate-500">
          Aucune aire configurée — ajoutez-en une ou enregistrez pour tout retirer.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
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
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          Enregistrer les aires
        </button>
      </div>
    </div>
  );
}
