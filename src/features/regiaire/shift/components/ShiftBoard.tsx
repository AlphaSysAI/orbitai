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
      getShiftMemberRole(),
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
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
            Passation de quart
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {SHIFT_PERIOD_LABELS[data.shift]} —{" "}
            {formatServiceDateFr(data.service_date)}
          </p>
        </div>
        <EquipeSubNav aireId={aireId} isAdmin={isAdmin} />
      </header>

      {data.isClosed && data.closure && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-600/10 p-4">
          <Lock className="mt-0.5 shrink-0 text-emerald-400" size={20} />
          <div className="text-sm text-slate-300">
            <p className="font-bold text-white">Quart clôturé</p>
            <p className="mt-1">
              {formatDateTimeFr(data.closure.closed_at)}
              {data.closure.closed_by === userId ? " — par vous" : ""}
            </p>
            <p className="mt-1">
              Complétion :{" "}
              <strong className="text-emerald-400">
                {data.closure.completion_pct}%
              </strong>{" "}
              ({data.closure.checked_tasks}/{data.closure.total_tasks})
            </p>
          </div>
        </div>
      )}

      {closeResult && !data.isClosed && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-600/10 p-4 text-sm text-amber-200">
          Clôture enregistrée — {closeResult.completion_pct}%
          {closeResult.missing_labels.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs">
              {closeResult.missing_labels.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
        <span className="text-xs text-slate-500">Progression</span>
        <span className="text-lg font-black tabular-nums text-amber-400">
          {checkedCount}/{totalCount} — {pct}%
        </span>
      </div>

      <ul className="space-y-2">
        {data.tasks.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-700 py-8 text-center text-sm text-slate-500">
            Aucune tâche configurée pour ce quart.
          </li>
        ) : (
          data.tasks.map((task) => (
            <li key={task.id}>
              <label
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors ${
                  data.isClosed
                    ? "cursor-default border-slate-800 bg-slate-900/30 opacity-80"
                    : "border-slate-800 bg-slate-900/50 hover:border-amber-500/30"
                } ${task.checked ? "border-emerald-500/30" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={task.checked}
                  disabled={data.isClosed || togglingId === task.id}
                  onChange={(e) => void handleToggle(task.id, e.target.checked)}
                  className="h-5 w-5 rounded border-slate-600 accent-amber-500"
                />
                <span
                  className={`flex-1 text-sm ${
                    task.checked ? "text-white" : "text-slate-300"
                  }`}
                >
                  {task.label}
                </span>
                {togglingId === task.id && (
                  <Loader2 size={16} className="animate-spin text-amber-400" />
                )}
                {task.checked && togglingId !== task.id && (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                )}
              </label>
            </li>
          ))
        )}
      </ul>

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Note de passation
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={data.isClosed}
          rows={4}
          placeholder="Observations, incidents, consignes pour le quart suivant…"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white disabled:opacity-60"
        />
      </div>

      {!data.isClosed && (
        <button
          type="button"
          onClick={() => void handleClose()}
          disabled={isClosing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-sm font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {isClosing && <Loader2 size={18} className="animate-spin" />}
          Clôturer le service
        </button>
      )}
    </div>
  );
}
