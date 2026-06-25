// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock } from "lucide-react";

import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import { useRegiaireOrg } from "@/features/regiaire/reception/hooks/useRegiaireOrg";
import {
  closeShift,
  getCurrentServiceContext,
  getShiftMemberRole,
  listShiftTasks,
  toggleTaskCheck,
} from "@/features/regiaire/shift/actions";
import { AdminShiftDashboard } from "@/features/regiaire/shift/components/AdminShiftDashboard";
import { EquipeSubNav } from "@/features/regiaire/shift/components/EquipeSubNav";
import type { ListShiftTasksResult } from "@/features/regiaire/shift/schemas";
import {
  formatDateTimeFr,
  formatServiceDateFr,
  SHIFT_PERIOD_LABELS,
} from "@/features/regiaire/shift/schemas";

export function ShiftBoard() {
  const aireId = useRegiaireAireId();
  const [data, setData] = useState<ListShiftTasksResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { userId } = useRegiaireOrg();
  const [closeResult, setCloseResult] = useState<{
    completion_pct: number;
    missing_labels: string[];
  } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [svcRes, tasksRes, roleRes] = await Promise.all([
      getCurrentServiceContext(aireId),
      listShiftTasks(aireId),
      getShiftMemberRole(aireId),
    ]);

    if (!svcRes.success) {
      setError(svcRes.error);
      setIsLoading(false);
      return;
    }

    if (!tasksRes.success) {
      setError(tasksRes.error);
      setIsLoading(false);
      return;
    }

    if (roleRes.success) {
      setIsAdmin(roleRes.isAdmin);
    }

    setData(tasksRes.data);
    if (tasksRes.data.closure?.note) {
      setNote(tasksRes.data.closure.note);
    }
    setIsLoading(false);
  }, [aireId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (taskDefId: string, checked: boolean) => {
    if (!data || data.isClosed) return;
    setTogglingId(taskDefId);

    const result = await toggleTaskCheck(
      aireId,
      data.shift,
      data.service_date,
      taskDefId,
      checked
    );

    setTogglingId(null);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskDefId
            ? { ...t, checked, checkedAt: checked ? new Date().toISOString() : null }
            : t
        ),
      };
    });
  };

  const handleClose = async () => {
    if (!data || data.isClosed) return;
    setIsClosing(true);
    setError(null);

    const result = await closeShift(aireId, data.shift, data.service_date, note || null);
    setIsClosing(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setCloseResult({
      completion_pct: result.data.closure.completion_pct,
      missing_labels: result.data.closure.missing_labels,
    });
    await load();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  if (isAdmin) {
    return <AdminShiftDashboard />;
  }

  if (error && !data) {
    return (
      <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (!data) return null;

  const checkedCount = data.tasks.filter((t) => t.checked).length;
  const totalCount = data.tasks.length;
  const pct =
    totalCount === 0 ? 100 : Math.round((checkedCount / totalCount) * 100);

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
              {SHIFT_PERIOD_LABELS[data.shift]}
            </p>
            <h1 className="mt-0.5 text-xl font-black uppercase tracking-tight text-white">
              Passation de quart
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatServiceDateFr(data.service_date)}
            </p>
          </div>
          {data.isClosed && (
            <span className="mt-1 flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-400">
              <Lock size={10} />
              Clôturé
            </span>
          )}
        </div>
        <EquipeSubNav aireId={aireId} isAdmin={isAdmin} />
      </header>

      {/* Closure details */}
      {data.isClosed && data.closure && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2">
            <Lock size={14} className="shrink-0 text-emerald-400" />
            <p className="text-sm font-bold text-emerald-300">Quart clôturé</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-900/60 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Complétion</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-400">
                {data.closure.completion_pct}%
              </p>
            </div>
            <div className="rounded-lg bg-slate-900/60 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Tâches</p>
              <p className="mt-0.5 text-lg font-black tabular-nums text-white">
                {data.closure.checked_tasks}/{data.closure.total_tasks}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {formatDateTimeFr(data.closure.closed_at)}
            {data.closure.closed_by === userId ? " · par vous" : ""}
          </p>
        </div>
      )}

      {closeResult && !data.isClosed && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-600/8 px-4 py-3 text-sm text-amber-200">
          Clôture enregistrée — {closeResult.completion_pct}%
          {closeResult.missing_labels.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-amber-300/70">
              {closeResult.missing_labels.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Progress bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
            Progression
          </span>
          <span className="text-sm font-black tabular-nums text-white">
            {checkedCount}
            <span className="text-slate-600">/{totalCount}</span>
            <span className="ml-2 text-amber-400">{pct}%</span>
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <ul className="space-y-1.5">
        {data.tasks.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-600">
            Aucune tâche configurée pour ce quart.
          </li>
        ) : (
          data.tasks.map((task) => (
            <li key={task.id}>
              <label
                className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150 ${
                  data.isClosed
                    ? "cursor-default border-slate-800/60 bg-slate-900/30 opacity-75"
                    : task.checked
                      ? "border-emerald-500/25 bg-emerald-500/5 hover:border-emerald-500/40"
                      : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                }`}
              >
                {/* Custom checkbox visual */}
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                  task.checked
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-slate-600 bg-slate-900 group-hover:border-slate-500"
                }`}>
                  {task.checked && (
                    <svg className="h-3 w-3 text-black" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={task.checked}
                  disabled={data.isClosed || togglingId === task.id}
                  onChange={(e) => void handleToggle(task.id, e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`flex-1 text-sm transition-colors ${
                    task.checked ? "text-slate-400 line-through decoration-slate-600" : "text-slate-200"
                  }`}
                >
                  {task.label}
                </span>
                {togglingId === task.id && (
                  <Loader2 size={14} className="animate-spin text-amber-400" />
                )}
                {task.checked && togglingId !== task.id && (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                )}
              </label>
            </li>
          ))
        )}
      </ul>

      {/* Note */}
      <div className="space-y-2">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
          Note de passation
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={data.isClosed}
          rows={3}
          placeholder="Observations, incidents, consignes pour le quart suivant…"
          className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-700 focus:border-slate-600 focus:outline-none disabled:opacity-50"
        />
      </div>

      {/* Close shift */}
      {!data.isClosed && (
        <button
          type="button"
          onClick={() => void handleClose()}
          disabled={isClosing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
        >
          {isClosing && <Loader2 size={16} className="animate-spin" />}
          Clôturer le service
        </button>
      )}
    </div>
  );
}
