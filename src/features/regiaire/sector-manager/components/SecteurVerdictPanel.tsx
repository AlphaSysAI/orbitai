// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { generateSecteurVerdict } from "@/features/regiaire/verdict/secteur/generate-secteur-verdict";
import type {
  SecteurActionItem,
  SecteurVerdictRecommendation,
} from "@/features/regiaire/verdict/secteur/schemas";

const PRIORITY_STYLE: Record<SecteurActionItem["priorite"], string> = {
  critique: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  haute: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  normale: "border-slate-700 bg-slate-900/60 text-slate-300",
};

export function SecteurVerdictPanel({ secteurId }: { secteurId: string }) {
  const [reco, setReco] = useState<SecteurVerdictRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (force: boolean) => {
    setIsLoading(true);
    setError(null);
    const result = await generateSecteurVerdict(secteurId, force);
    setIsLoading(false);
    setHasRun(true);
    if (result.success) setReco(result.data.recommendation);
    else setError(result.error);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/12 via-slate-900/85 to-slate-950 p-6">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/0 via-violet-500/60 to-violet-500/0" />

      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 ring-1 ring-violet-500/30">
          <Brain className="text-violet-400" size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400/70">
            Verdict IA · Secteur
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-white">
            Plan d&apos;action consolidé
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Croise toutes les aires du secteur → priorités marge, rendement et heures.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void run(false)}
          disabled={isLoading}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/20 disabled:opacity-50 sm:flex-none"
        >
          {isLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Sparkles size={13} />
          )}
          Générer le plan du jour
        </button>
        {reco && (
          <button
            type="button"
            onClick={() => void run(true)}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500 transition-all hover:border-violet-500/30 hover:text-violet-300 disabled:opacity-50"
          >
            <RefreshCw size={13} />
            Régénérer
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {isLoading && !reco && (
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-400">
          <Loader2 className="animate-spin text-violet-400" size={18} />
          Analyse des aires du secteur…
        </div>
      )}

      {!isLoading && hasRun && !reco && !error && (
        <p className="mt-6 text-sm text-slate-500">Aucune donnée exploitable pour le moment.</p>
      )}

      {reco && (
        <div className="mt-6 space-y-5">
          {/* Synthèse */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <p className="text-sm leading-relaxed text-slate-300">{reco.synthese}</p>
          </div>

          {/* Plan d'action */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              Plan d&apos;action
            </p>
            {reco.plan_action.map((item, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${PRIORITY_STYLE[item.priorite]}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">{item.titre}</p>
                  <span className="shrink-0 rounded-full bg-black/30 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                    {item.priorite}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-300/90">{item.detail}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                  {item.aire_cible && (
                    <span className="rounded-md bg-slate-900/60 px-2 py-0.5 font-bold text-slate-400">
                      {item.aire_cible}
                    </span>
                  )}
                  {item.impact_estime && (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-300">
                      {item.impact_estime}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Leviers */}
          <div className="grid gap-3 sm:grid-cols-2">
            <LeverList
              icon={<TrendingUp size={13} className="text-emerald-400" />}
              title="Leviers marge"
              items={reco.leviers_marge}
            />
            <LeverList
              icon={<Gauge size={13} className="text-sky-400" />}
              title="Leviers rendement"
              items={reco.leviers_rendement}
            />
          </div>

          {/* Alertes */}
          {reco.alertes.length > 0 && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-rose-300">
                <AlertTriangle size={13} />
                Alertes
              </p>
              <ul className="mt-2 space-y-1">
                {reco.alertes.map((a, i) => (
                  <li key={i} className="text-xs text-rose-200/90">
                    • {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LeverList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
        {icon}
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {items.length === 0 ? (
          <li className="text-xs text-slate-600">—</li>
        ) : (
          items.map((it, i) => (
            <li key={i} className="text-xs leading-snug text-slate-300">
              • {it}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
