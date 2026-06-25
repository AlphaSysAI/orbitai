// Copyright © 2026 OrbitSys. Tous droits réservés.

import { CheckCircle2, TrendingUp, Zap } from "lucide-react";

import {
  DIRECTION_CONFIG,
  EMPHASE_LABELS,
  formatDeltaPct,
  MOUVEMENT_CONFIG,
} from "@/features/regiaire/verdict/lib/verdict-display";
import type { VerdictRecommendation } from "@/features/regiaire/verdict/schemas";

type Props = { recommendation: VerdictRecommendation };

const PRIORITE_CONFIG = {
  critique: {
    label: "Critique",
    className: "border-red-500/40 bg-red-500/10 text-red-300",
    dot: "bg-red-500",
  },
  haute: {
    label: "Haute",
    className: "border-orange-500/40 bg-orange-500/10 text-orange-300",
    dot: "bg-orange-400",
  },
  normale: {
    label: "Normale",
    className: "border-slate-600 bg-slate-800/60 text-slate-400",
    dot: "bg-slate-500",
  },
};

export function VerdictRecommendations({ recommendation }: Props) {
  const hasBriefing = recommendation.directeur_briefing != null && recommendation.directeur_briefing.length > 0;
  const hasOpportunites = recommendation.opportunites_roi != null && recommendation.opportunites_roi.length > 0;
  const hasActions = recommendation.actions_immediates != null && recommendation.actions_immediates.length > 0;

  return (
    <section className="space-y-5">

      {/* Briefing directeur */}
      {hasBriefing && (
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/10 via-slate-900/80 to-slate-900/60 p-6">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">
            Briefing Directeur
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-200">
            {recommendation.directeur_briefing}
          </p>
        </div>
      )}

      {/* Opportunités ROI */}
      {hasOpportunites && (
        <div>
          <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <TrendingUp size={12} className="text-emerald-400" />
            Opportunités ROI
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendation.opportunites_roi!.map((opp, i) => {
              const cfg = PRIORITE_CONFIG[opp.priorite];
              return (
                <div
                  key={i}
                  className={`rounded-2xl border p-4 ${cfg.className}`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-70">
                      {cfg.label}
                    </span>
                    <span className="ml-auto text-[10px] font-bold text-white">
                      {opp.categorie}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-200">{opp.action}</p>
                  <p className="mt-1.5 text-xs font-bold text-emerald-400">
                    {opp.impact_estime}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions immédiates */}
      {hasActions && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-600/5 p-5">
          <p className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
            <Zap size={12} />
            Actions immédiates
          </p>
          <ul className="space-y-2">
            {recommendation.actions_immediates!.map((action, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-200">
                <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0 text-emerald-500" />
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Synthèse (fallback si pas de briefing directeur) */}
      {!hasBriefing && recommendation.synthese != null && recommendation.synthese.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-600/10 to-slate-900/60 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80">
            Synthèse
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-200">
            {recommendation.synthese}
          </p>
        </div>
      )}

      {/* Recommandations par rayon */}
      <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Recommandations par rayon
        </p>
        <ul className="space-y-3">
          {recommendation.rayons.map((rayon) => {
            const cfg = DIRECTION_CONFIG[rayon.direction];
            const Icon = cfg.icon;
            return (
              <li
                key={rayon.category}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-white">
                    {rayon.category}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cfg.className}`}
                    >
                      <Icon size={12} />
                      {cfg.label}
                    </span>
                    <span className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {EMPHASE_LABELS[rayon.emphase]}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {rayon.justification}
                </p>
                {rayon.impact_estime != null && rayon.impact_estime.length > 0 && (
                  <p className="mt-2 text-xs font-bold text-emerald-400">
                    {rayon.impact_estime}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Top mouvements */}
      {recommendation.top_mouvements.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Top mouvements vs N-1 (15 j)
          </p>
          <ul className="space-y-2">
            {recommendation.top_mouvements.map((mvt) => (
              <li
                key={mvt.category}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="text-sm font-medium text-white">
                  {mvt.category}
                </span>
                <span
                  className={`text-sm font-black tabular-nums ${MOUVEMENT_CONFIG[mvt.direction].className}`}
                >
                  {formatDeltaPct(mvt.deltaPct)}
                </span>
                <p className="w-full text-xs text-slate-500">
                  {mvt.justification}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
