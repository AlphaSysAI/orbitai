"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  getShiftMemberRole,
  listClosuresForDate,
} from "@/features/regiaire/shift/actions";
import { EquipeSubNav } from "@/features/regiaire/shift/components/EquipeSubNav";
import {
  ALL_SHIFT_PERIODS,
  formatServiceDateFr,
  formatDateTimeFr,
  SHIFT_PERIOD_LABELS,
  type ShiftClosure,
  type ShiftPeriod,
} from "@/features/regiaire/shift/schemas";
import { serviceContext } from "@/features/regiaire/shift/service-context-core";

function closureForShift(
  closures: ShiftClosure[],
  shift: ShiftPeriod
): ShiftClosure | undefined {
  return closures.find((c) => c.shift === shift);
}

export function ShiftHistoryView() {
  const [selectedDate, setSelectedDate] = useState(
    () => serviceContext().service_date
  );
  const [closures, setClosures] = useState<ShiftClosure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const roleRes = await getShiftMemberRole();
    if (roleRes.success) {
      setIsAdmin(roleRes.isAdmin);
    }

    const res = await listClosuresForDate(selectedDate);
    if (!res.success) {
      setError(res.error);
    } else {
      setClosures(res.data);
    }
    setIsLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
            Historique
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Clôtures par date de service.
          </p>
        </div>
        <EquipeSubNav isAdmin={isAdmin} />
      </header>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Date de service
        </span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
        />
      </label>

      <p className="text-xs text-slate-500">
        Journée du {formatServiceDateFr(selectedDate)}
      </p>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-amber-400" />
        </div>
      ) : (
        <ul className="space-y-3">
          {ALL_SHIFT_PERIODS.map((shift) => {
            const closure = closureForShift(closures, shift);
            return (
              <li
                key={shift}
                className={`rounded-xl border p-4 ${
                  closure
                    ? "border-slate-800 bg-slate-900/50"
                    : "border-dashed border-slate-700 bg-slate-900/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-white">
                    {SHIFT_PERIOD_LABELS[shift]}
                  </h2>
                  {closure ? (
                    <span
                      className={`text-sm font-black tabular-nums ${
                        closure.completion_pct >= 100
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {closure.completion_pct}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-600">Non clôturé</span>
                  )}
                </div>
                {closure && (
                  <div className="mt-2 space-y-1 text-xs text-slate-400">
                    <p>
                      {closure.checked_tasks}/{closure.total_tasks} tâches —{" "}
                      {formatDateTimeFr(closure.closed_at)}
                    </p>
                    {closure.missing_labels.length > 0 && (
                      <p className="text-amber-400/80">
                        Manquantes : {closure.missing_labels.join(", ")}
                      </p>
                    )}
                    {closure.note && (
                      <p className="mt-2 rounded-lg bg-slate-950/50 p-2 text-slate-300">
                        {closure.note}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
