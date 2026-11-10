// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import {
  getPreviousShiftHandover,
  getShiftMemberRole,
  listClosuresForDate,
  type PreviousShiftHandover,
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
  const aireId = useRegiaireAireId();
  const [selectedDate, setSelectedDate] = useState(
    () => serviceContext().service_date
  );
  const [closures, setClosures] = useState<ShiftClosure[]>([]);
  const [handover, setHandover] = useState<PreviousShiftHandover | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const roleRes = await getShiftMemberRole(aireId);
    if (!roleRes.success) {
      setError(roleRes.error);
      setIsLoading(false);
      return;
    }

    setIsAdmin(roleRes.isAdmin);

    if (roleRes.isAdmin) {
      const res = await listClosuresForDate(aireId, selectedDate);
      if (!res.success) {
        setError(res.error);
      } else {
        setClosures(res.data);
      }
    } else {
      const res = await getPreviousShiftHandover(aireId);
      if (!res.success) {
        setError(res.error);
      } else {
        setHandover(res.data);
      }
    }

    setIsLoading(false);
  }, [selectedDate, aireId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <header className="space-y-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-700">Équipe</p>
          <h1 className="mt-0.5 text-xl font-black uppercase tracking-tight text-white">
            {isAdmin ? "Historique" : "Passation précédente"}
          </h1>
        </div>
        <EquipeSubNav aireId={aireId} isAdmin={isAdmin} />
      </header>

      {isAdmin && (
        <>
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
        </>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-amber-400" />
        </div>
      ) : isAdmin ? (
        <ul className="space-y-2">
          {ALL_SHIFT_PERIODS.map((shift) => {
            const closure = closureForShift(closures, shift);
            const pct = closure?.completion_pct ?? 0;
            return (
              <li
                key={shift}
                className={`rounded-2xl border p-4 ${
                  closure
                    ? "border-slate-800 bg-slate-900/70"
                    : "border-dashed border-slate-800 bg-slate-900/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">Quart</p>
                    <h2 className="font-bold text-white">{SHIFT_PERIOD_LABELS[shift]}</h2>
                  </div>
                  {closure ? (
                    <span className={`text-xl font-black tabular-nums ${pct >= 100 ? "text-emerald-400" : "text-amber-400"}`}>
                      {pct}%
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-800 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700">
                      Non clôturé
                    </span>
                  )}
                </div>
                {closure && (
                  <>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                      <p>{closure.checked_tasks}/{closure.total_tasks} tâches · {formatDateTimeFr(closure.closed_at)}</p>
                      {closure.missing_labels.length > 0 && (
                        <p className="text-amber-400/70">Manquantes : {closure.missing_labels.join(", ")}</p>
                      )}
                      {closure.note && (
                        <p className="mt-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-slate-300">
                          {closure.note}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <MemberHandoverCard handover={handover} />
      )}
    </div>
  );
}

function MemberHandoverCard({
  handover,
}: {
  handover: PreviousShiftHandover | null;
}) {
  if (!handover) {
    return (
      <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
        Impossible de charger la passation.
      </p>
    );
  }

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
        Quart précédent
      </p>
      <h2 className="mt-1 text-lg font-bold text-white">
        {handover.shiftLabel}
      </h2>
      <p className="text-xs text-slate-500">
        Journée du {handover.serviceDateLabel}
      </p>

      {!handover.hasClosure ? (
        <p className="mt-4 text-sm text-slate-500">
          Aucune clôture enregistrée pour ce quart.
        </p>
      ) : handover.note ? (
        <p className="mt-4 rounded-lg bg-slate-950/50 p-4 text-sm leading-relaxed text-slate-300">
          {handover.note}
        </p>
      ) : (
        <p className="mt-4 text-sm text-slate-500 italic">
          Aucune note de passation laissée.
        </p>
      )}
    </article>
  );
}
