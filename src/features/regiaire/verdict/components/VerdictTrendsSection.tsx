// Copyright © 2026 OrbitSys. Tous droits réservés.

import { formatDeltaPct } from "@/features/regiaire/verdict/lib/verdict-display";
import type { TrendCategorySummary } from "@/features/regiaire/verdict/schemas";

type VerdictTrendsSectionProps = {
  trends: TrendCategorySummary[];
};

export function VerdictTrendsSection({ trends }: VerdictTrendsSectionProps) {
  if (trends.length === 0) return null;

  const maxQty = Math.max(
    ...trends.flatMap((t) => [t.current15d, t.lastYear15d]),
    1
  );

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
      <header className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Tendances 15 j vs N-1
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Quantités vendues — période courante vs même fenêtre l&apos;an dernier
          (alignée).
        </p>
        <div className="mt-2 flex gap-4 text-[9px] font-bold uppercase tracking-wider text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-amber-500" />
            Courant
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-slate-600" />
            N-1
          </span>
        </div>
      </header>

      <ul className="space-y-4">
        {trends.map((trend) => {
          const currentPct = (trend.current15d / maxQty) * 100;
          const lastYearPct = (trend.lastYear15d / maxQty) * 100;
          const delta = trend.deltaPct;

          return (
            <li key={trend.category}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-white">
                  {trend.category}
                </span>
                <span
                  className={`shrink-0 text-xs font-bold tabular-nums ${
                    delta === null
                      ? "text-slate-500"
                      : delta > 0
                        ? "text-emerald-400"
                        : delta < 0
                          ? "text-red-400"
                          : "text-slate-400"
                  }`}
                >
                  {formatDeltaPct(delta)}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-950">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{ width: `${currentPct}%` }}
                  />
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-slate-950">
                  <div
                    className="h-full rounded-full bg-slate-600 transition-all"
                    style={{ width: `${lastYearPct}%` }}
                  />
                </div>
              </div>
              <p className="mt-1 text-[10px] tabular-nums text-slate-600">
                {trend.current15d} u. · N-1 : {trend.lastYear15d} u.
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
