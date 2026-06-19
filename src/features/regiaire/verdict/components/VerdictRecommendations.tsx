import {
  DIRECTION_CONFIG,
  EMPHASE_LABELS,
  formatDeltaPct,
  MOUVEMENT_CONFIG,
} from "@/features/regiaire/verdict/lib/verdict-display";
import type { VerdictRecommendation } from "@/features/regiaire/verdict/schemas";

type VerdictRecommendationsProps = {
  recommendation: VerdictRecommendation;
};

export function VerdictRecommendations({
  recommendation,
}: VerdictRecommendationsProps) {
  return (
    <section className="space-y-5">
      {recommendation.synthese && (
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-600/10 to-slate-900/60 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80">
            Synthèse
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-200">
            {recommendation.synthese}
          </p>
        </div>
      )}

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
              </li>
            );
          })}
        </ul>
      </div>

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
