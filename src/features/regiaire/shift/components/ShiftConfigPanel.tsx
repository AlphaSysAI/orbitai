// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import {
  deleteTaskDef,
  getShiftMemberRole,
  listTaskDefsConfig,
  reorderTaskDefs,
  upsertTaskDef,
} from "@/features/regiaire/shift/actions";
import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import { EquipeSubNav } from "@/features/regiaire/shift/components/EquipeSubNav";
import {
  ALL_SHIFT_PERIODS,
  SHIFT_PERIOD_LABELS,
  type ShiftPeriod,
  type ShiftTaskDef,
} from "@/features/regiaire/shift/schemas";

export function ShiftConfigPanel() {
  const aireId = useRegiaireAireId();
  const [defs, setDefs] = useState<ShiftTaskDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newShifts, setNewShifts] = useState<ShiftPeriod[]>(["matin"]);

  const load = useCallback(async () => {
    setIsLoading(true);
    const roleRes = await getShiftMemberRole(aireId);
    if (!roleRes.success || !roleRes.isAdmin) {
      setAccessDenied(true);
      setIsLoading(false);
      return;
    }
    setIsAdmin(true);

    const res = await listTaskDefsConfig(aireId);
    if (!res.success) {
      setError(res.error);
    } else {
      setDefs(res.data.filter((d) => d.active));
    }
    setIsLoading(false);
  }, [aireId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleNewShift = (shift: ShiftPeriod) => {
    setNewShifts((prev) =>
      prev.includes(shift) ? prev.filter((s) => s !== shift) : [...prev, shift]
    );
  };

  const handleCreate = async () => {
    if (!newLabel.trim() || newShifts.length === 0) return;
    setIsSaving(true);
    const res = await upsertTaskDef(aireId, {
      label: newLabel.trim(),
      shifts: newShifts,
      active: true,
    });
    setIsSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setNewLabel("");
    await load();
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    const res = await deleteTaskDef(aireId, id);
    setIsSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    await load();
  };

  const moveDef = async (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= defs.length) return;
    const reordered = [...defs];
    const tmp = reordered[index]!;
    reordered[index] = reordered[next]!;
    reordered[next] = tmp;
    setDefs(reordered);
    await reorderTaskDefs(aireId, reordered.map((d) => d.id));
  };

  const toggleDefShift = async (def: ShiftTaskDef, shift: ShiftPeriod) => {
    const shifts = def.shifts.includes(shift)
      ? def.shifts.filter((s) => s !== shift)
      : [...def.shifts, shift];
    if (shifts.length === 0) return;
    setIsSaving(true);
    const res = await upsertTaskDef(aireId, {
      id: def.id,
      label: def.label,
      shifts,
      active: true,
    });
    setIsSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    await load();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-red-300">Accès réservé aux administrateurs.</p>
        <Link href={`/station/${aireId}/equipe`} className="mt-4 inline-block text-amber-400 underline">
          Retour passation
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
            Config check-list
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Tâches par quart — owner / admin uniquement.
          </p>
        </div>
        <EquipeSubNav aireId={aireId} isAdmin={isAdmin} />
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Nouvelle tâche
        </p>
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Ex. Vérifier les niveaux carburant"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
        <div className="flex flex-wrap gap-2">
          {ALL_SHIFT_PERIODS.map((shift) => (
            <button
              key={shift}
              type="button"
              onClick={() => toggleNewShift(shift)}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                newShifts.includes(shift)
                  ? "bg-amber-600 text-white"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {SHIFT_PERIOD_LABELS[shift]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isSaving || !newLabel.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>

      <ul className="space-y-2">
        {defs.map((def, index) => (
          <li
            key={def.id}
            className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-white">{def.label}</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void moveDef(index, -1)}
                  disabled={index === 0 || isSaving}
                  className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => void moveDef(index, 1)}
                  disabled={index === defs.length - 1 || isSaving}
                  className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(def.id)}
                  disabled={isSaving}
                  className="rounded p-1 text-red-400 hover:text-red-300 disabled:opacity-30"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_SHIFT_PERIODS.map((shift) => (
                <button
                  key={shift}
                  type="button"
                  disabled={isSaving}
                  onClick={() => void toggleDefShift(def, shift)}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                    def.shifts.includes(shift)
                      ? "bg-amber-600/30 text-amber-400 border border-amber-500/40"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {SHIFT_PERIOD_LABELS[shift]}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
