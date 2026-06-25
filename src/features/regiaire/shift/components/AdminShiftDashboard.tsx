// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

import { useRegiaireAireId } from "@/features/regiaire/hooks/useRegiaireAireId";
import { generateShiftManagerVerdict } from "@/features/regiaire/shift/actions/generate-shift-verdict";
import type { ShiftVerdict } from "@/features/regiaire/shift/schemas";
import { listClosures, listShiftTasks } from "@/features/regiaire/shift/actions";
import { EquipeSubNav } from "@/features/regiaire/shift/components/EquipeSubNav";
import {
  ALL_SHIFT_PERIODS,
  formatServiceDateFr,
  SHIFT_PERIOD_LABELS,
  type ShiftClosure,
  type ShiftPeriod,
} from "@/features/regiaire/shift/schemas";

/* ─── utils ─────────────────────────────────────────────────────────────── */

function getLast7Dates(): string[] {
  const tz = "Europe/Paris";
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0] as string;
  });
}

function todayParis(): string {
  return getLast7Dates()[0] as string;
}

function pctColor(pct: number): string {
  if (pct >= 100) return "text-emerald-400";
  if (pct >= 80) return "text-amber-400";
  return "text-red-400";
}

function pctBg(pct: number): string {
  if (pct >= 100) return "border-emerald-500/30 bg-emerald-600/10";
  if (pct >= 80) return "border-amber-500/30 bg-amber-600/10";
  return "border-red-500/30 bg-red-600/10";
}

/* ─── types ─────────────────────────────────────────────────────────────── */

type DayRow = {
  date: string;
  byShift: Record<ShiftPeriod, ShiftClosure | undefined>;
};

type LiveShift = {
  shift: ShiftPeriod;
  tasks: { id: string; label: string; checked: boolean }[];
  isClosed: boolean;
  checkedCount: number;
  totalCount: number;
};

/* ─── component ─────────────────────────────────────────────────────────── */

export function AdminShiftDashboard() {
  const aireId = useRegiaireAireId();

  const [closures, setClosures] = useState<ShiftClosure[]>([]);
  const [liveShift, setLiveShift] = useState<LiveShift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verdict, setVerdict] = useState<ShiftVerdict | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [verdictError, setVerdictError] = useState<string | null>(null);

  const [liveExpanded, setLiveExpanded] = useState(true);
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* --- data load --------------------------------------------------------- */

  const loadLive = useCallback(async () => {
    const res = await listShiftTasks(aireId);
    if (res.success) {
      setLiveShift({
        shift: res.data.shift,
        tasks: res.data.tasks,
        isClosed: res.data.isClosed,
        checkedCount: res.data.tasks.filter((t) => t.checked).length,
        totalCount: res.data.tasks.length,
      });
    }
  }, [aireId]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const dates = getLast7Dates();
    const from = dates[6] ?? dates[0] ?? "";
    const to = dates[0] ?? "";
    const [closuresRes] = await Promise.all([
      listClosures(aireId, from, to),
      loadLive(),
    ]);

    if (!closuresRes.success) {
      setError(closuresRes.error);
    } else {
      setClosures(closuresRes.data);
    }

    setIsLoading(false);
  }, [aireId, loadLive]);

  useEffect(() => {
    void loadAll();

    // Rafraîchit le suivi live toutes les 30 s
    liveIntervalRef.current = setInterval(() => void loadLive(), 30_000);
    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, [loadAll, loadLive]);

  /* --- AI verdict --------------------------------------------------------- */

  const handleGenerateVerdict = async () => {
    setIsGenerating(true);
    setVerdictError(null);
    const res = await generateShiftManagerVerdict(aireId, closures);
    setIsGenerating(false);
    if (res.success) {
      setVerdict(res.data);
    } else {
      setVerdictError(res.error);
    }
  };

  /* --- derived data ------------------------------------------------------- */

  const dates = getLast7Dates();
  const today = todayParis();

  const dayRows: DayRow[] = dates.map((date) => ({
    date,
    byShift: Object.fromEntries(
      ALL_SHIFT_PERIODS.map((s) => [
        s,
        closures.find((c) => c.service_date === date && c.shift === s),
      ])
    ) as Record<ShiftPeriod, ShiftClosure | undefined>,
  }));

  const closedShifts = closures.length;
  const maxPossible = 7 * 3;
  const avgPct =
    closures.length > 0
      ? Math.round(closures.reduce((s, c) => s + c.completion_pct, 0) / closures.length)
      : null;

  const missCounts = new Map<string, number>();
  for (const c of closures) {
    for (const label of c.missing_labels) {
      missCounts.set(label, (missCounts.get(label) ?? 0) + 1);
    }
  }
  const topMissed =
    missCounts.size > 0
      ? [...missCounts.entries()].sort((a, b) => b[1] - a[1])[0]
      : null;

  /* --- render ------------------------------------------------------------- */

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-amber-400" size={32} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-extrabold uppercase italic tracking-tighter text-white">
            Tableau de bord équipes
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Suivi des 7 derniers jours · Mise à jour en direct
          </p>
        </div>
        <EquipeSubNav aireId={aireId} isAdmin />
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* ── Encarts stats ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Complétion moyenne"
          value={avgPct !== null ? `${avgPct}%` : "—"}
          sub="7 derniers jours"
          color={avgPct !== null ? pctColor(avgPct) : "text-slate-400"}
        />
        <StatCard
          label="Quarts clôturés"
          value={`${closedShifts}/${maxPossible}`}
          sub="sur 7 jours (3 quarts/j)"
          color={
            closedShifts === maxPossible
              ? "text-emerald-400"
              : closedShifts >= maxPossible * 0.8
              ? "text-amber-400"
              : "text-red-400"
          }
        />
        <StatCard
          label="Tâche la + manquée"
          value={topMissed ? topMissed[0] : "Aucune"}
          sub={topMissed ? `${topMissed[1]} fois sur 7 j` : "Tout est complété"}
          color={topMissed && topMissed[1] >= 3 ? "text-red-400" : "text-slate-300"}
          small
        />
      </div>

      {/* ── Suivi live ── */}
      {liveShift && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => setLiveExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span className="text-sm font-bold text-white">
                Suivi en direct — {SHIFT_PERIOD_LABELS[liveShift.shift]}
              </span>
              <span className={`text-sm font-black tabular-nums ${pctColor(liveShift.totalCount === 0 ? 100 : Math.round((liveShift.checkedCount / liveShift.totalCount) * 100))}`}>
                {liveShift.checkedCount}/{liveShift.totalCount}
              </span>
              {liveShift.isClosed && (
                <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                  Clôturé
                </span>
              )}
            </div>
            {liveExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
          </button>

          {liveExpanded && (
            <div className="border-t border-slate-800 px-5 pb-5 pt-3">
              <ul className="space-y-1.5">
                {liveShift.tasks.length === 0 ? (
                  <li className="text-sm text-slate-500">Aucune tâche configurée.</li>
                ) : (
                  liveShift.tasks.map((task) => (
                    <li
                      key={task.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                        task.checked ? "bg-emerald-600/8" : ""
                      }`}
                    >
                      <span
                        className={`h-4 w-4 flex-shrink-0 rounded border-2 transition-colors ${
                          task.checked
                            ? "border-emerald-500 bg-emerald-500/20"
                            : "border-slate-600"
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          task.checked ? "text-emerald-300 line-through decoration-emerald-600" : "text-slate-300"
                        }`}
                      >
                        {task.label}
                      </span>
                      {task.checked && (
                        <CheckCircle2 size={14} className="ml-auto text-emerald-500" />
                      )}
                    </li>
                  ))
                )}
              </ul>
              <button
                type="button"
                onClick={() => void loadLive()}
                className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:text-slate-400"
              >
                <RefreshCw size={11} />
                Actualiser
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── Tableau 7 jours ── */}
      <section>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Évolution sur 7 jours
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Date
                </th>
                {ALL_SHIFT_PERIODS.map((s) => (
                  <th
                    key={s}
                    className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500"
                  >
                    {SHIFT_PERIOD_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dayRows.map((row, i) => (
                <tr
                  key={row.date}
                  className={`border-b border-slate-800/60 last:border-0 ${
                    row.date === today ? "bg-amber-600/5" : i % 2 === 0 ? "bg-slate-950/20" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-slate-300">
                      {formatServiceDateFr(row.date)}
                    </span>
                    {row.date === today && (
                      <span className="ml-2 text-[9px] font-bold uppercase text-amber-400">
                        Aujourd'hui
                      </span>
                    )}
                  </td>
                  {ALL_SHIFT_PERIODS.map((shift) => {
                    const c = row.byShift[shift];
                    return (
                      <td key={shift} className="px-4 py-3 text-center">
                        {c ? (
                          <div className="space-y-1">
                            <span
                              className={`inline-block rounded-lg border px-2.5 py-1 text-xs font-black tabular-nums ${pctBg(c.completion_pct)} ${pctColor(c.completion_pct)}`}
                            >
                              {c.completion_pct}%
                            </span>
                            {c.missing_labels.length > 0 && (
                              <ul className="space-y-0.5">
                                {c.missing_labels.map((label) => (
                                  <li key={label} className="text-[10px] text-red-400/80">
                                    ✗ {label}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-700">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Verdict IA ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Analyse IA — Management équipes
          </p>
          <button
            type="button"
            onClick={() => void handleGenerateVerdict()}
            disabled={isGenerating || closures.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Brain size={13} />
            )}
            {verdict ? "Regénérer" : "Générer l'analyse"}
          </button>
        </div>

        {verdictError && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {verdictError}
          </p>
        )}

        {isGenerating && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 px-5 py-6 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin text-violet-400" />
            Analyse en cours…
          </div>
        )}

        {verdict && !isGenerating && (
          <div className="space-y-4">
            {/* Tendance + synthèse */}
            <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/10 via-slate-900/80 to-slate-900/60 p-6">
              <div className="mb-3 flex items-center gap-3">
                <TendanceBadge tendance={verdict.tendance} />
              </div>
              <p className="text-sm leading-relaxed text-slate-200">
                {verdict.synthese}
              </p>
            </div>

            {/* Alerte */}
            {verdict.alerte && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-600/8 p-5">
                <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-400" />
                <p className="text-sm text-red-200">{verdict.alerte}</p>
              </div>
            )}

            {/* Points critiques */}
            {verdict.points_critiques.length > 0 && (
              <div>
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Points critiques
                </p>
                <ul className="space-y-3">
                  {verdict.points_critiques.map((pt, i) => (
                    <li
                      key={i}
                      className="rounded-2xl border border-red-500/20 bg-red-600/5 p-4"
                    >
                      <p className="mb-1 text-sm font-bold text-red-300">{pt.tache}</p>
                      <p className="text-sm text-slate-400">{pt.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommandations */}
            {verdict.recommandations.length > 0 && (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-600/5 p-5">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                  Recommandations managériales
                </p>
                <ul className="space-y-2">
                  {verdict.recommandations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                      <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!verdict && !isGenerating && closures.length === 0 && (
          <p className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
            Aucune clôture disponible sur les 7 derniers jours.
          </p>
        )}

        {!verdict && !isGenerating && closures.length > 0 && (
          <p className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 px-4 py-6 text-center text-sm text-slate-600">
            Cliquez sur "Générer l'analyse" pour obtenir un diagnostic IA.
          </p>
        )}
      </section>
    </div>
  );
}

/* ─── sub-components ─────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  color,
  small = false,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 font-black tabular-nums ${small ? "text-base" : "text-3xl"} ${color}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-600">{sub}</p>
    </div>
  );
}

function TendanceBadge({
  tendance,
}: {
  tendance: "amelioration" | "stable" | "degradation";
}) {
  const config = {
    amelioration: {
      icon: <TrendingUp size={15} />,
      label: "En amélioration",
      className: "border-emerald-500/40 bg-emerald-600/15 text-emerald-300",
    },
    stable: {
      icon: <Minus size={15} />,
      label: "Stable",
      className: "border-slate-600 bg-slate-800/60 text-slate-300",
    },
    degradation: {
      icon: <TrendingDown size={15} />,
      label: "En dégradation",
      className: "border-red-500/40 bg-red-600/15 text-red-300",
    },
  };
  const cfg = config[tendance];
  return (
    <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${cfg.className}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
