// Copyright © 2026 OrbitSys. Tous droits réservés.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { getAire } from "@/features/regiaire/aires/actions";
import {
  generateVerdict,
  getExpiringStock,
} from "@/features/regiaire/verdict/actions";
import { regenerateVerdict } from "@/features/regiaire/verdict/actions/regenerate-verdict";
import {
  OrderDayBadge,
  VerdictSignalsBanner,
} from "@/features/regiaire/verdict/components/VerdictSignalsBanner";
import { VerdictRecommendations } from "@/features/regiaire/verdict/components/VerdictRecommendations";
import { VerdictTrendsSection } from "@/features/regiaire/verdict/components/VerdictTrendsSection";
import { VerdictExpiringSection } from "@/features/regiaire/verdict/components/VerdictExpiringSection";
import { VerdictReplenishmentSection } from "@/features/regiaire/verdict/components/VerdictReplenishmentSection";
import {
  AFFLUENCE_CONFIG,
  formatVerdictDate,
  isoDayOfWeek,
} from "@/features/regiaire/verdict/lib/verdict-display";
import type {
  ExpiringStockResult,
  VerdictRun,
} from "@/features/regiaire/verdict/schemas";

type VerdictScreenProps = {
  aireId: string;
};

export function VerdictScreen({ aireId }: VerdictScreenProps) {
  const [aireName, setAireName] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<VerdictRun | null>(null);
  const [expiring, setExpiring] = useState<ExpiringStockResult | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExpiring = useCallback(async (runDate?: string) => {
    const result = await getExpiringStock(aireId, runDate);
    if (result.success) {
      setExpiring(result.data);
    }
  }, [aireId]);

  const loadVerdict = useCallback(
    async (force = false) => {
      setIsGenerating(true);
      setError(null);

      const result = force
        ? await regenerateVerdict(aireId)
        : await generateVerdict(aireId);

      setIsGenerating(false);

      if (!result.success) {
        setError(result.error);
        return false;
      }

      setVerdict(result.data);
      setIsCached(result.cached);
      await loadExpiring(result.data.runDate);
      return true;
    },
    [aireId, loadExpiring]
  );

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      const aireResult = await getAire(aireId);
      if (aireResult.success) {
        setAireName(aireResult.data.name);
      }
      await loadVerdict(false);
      setIsLoading(false);
    })();
  }, [aireId, loadVerdict]);

  const handleGenerate = () => void loadVerdict(false);
  const handleRegenerate = () => void loadVerdict(true);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-amber-400" size={36} />
      </div>
    );
  }

  const runDate = verdict?.runDate;
  const isOrderDay =
    runDate != null &&
    verdict?.signals.station.orderDays.includes(isoDayOfWeek(runDate));

  const affluence = verdict?.recommendation.affluence_attendue;
  const affluenceCfg = affluence ? AFFLUENCE_CONFIG[affluence] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 pb-16 sm:py-8">
      {/* Hero header — violet : identité IA */}
      <header className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-600/12 via-slate-900/85 to-slate-950 p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-violet-500/0 via-violet-500/60 to-violet-500/0" />

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 ring-1 ring-violet-500/30">
            <Brain className="text-violet-400" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-violet-400/70">
                Verdict IA{aireName ? ` · ${aireName}` : ""}
              </p>
              {isCached && verdict && (
                <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-600">
                  cache
                </span>
              )}
            </div>
            {runDate ? (
              <h1 className="mt-1 text-2xl font-black capitalize leading-tight tracking-tight text-white sm:text-3xl">
                {formatVerdictDate(runDate)}
              </h1>
            ) : (
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                Analyse du jour
              </h1>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <OrderDayBadge show={Boolean(isOrderDay)} />
            </div>
          </div>
        </div>

        {/* Affluence banner */}
        {affluenceCfg && affluence && (
          <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-2.5 ${affluenceCfg.className}`}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${affluenceCfg.dotClass}`} />
            <p className="text-[11px] font-black uppercase tracking-wider">
              {affluenceCfg.label}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/20 disabled:opacity-50 sm:flex-none"
          >
            {isGenerating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            Générer le Verdict du jour
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isGenerating || !verdict}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500 transition-all hover:border-violet-500/30 hover:text-violet-300 disabled:opacity-50"
          >
            <RefreshCw size={13} />
            Régénérer
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </header>

      {/* Generating state */}
      {isGenerating && !verdict && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-violet-500/15 bg-violet-600/5 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
            <Loader2 className="animate-spin text-violet-400" size={28} />
          </div>
          <div className="text-center">
            <p className="font-bold text-white">Analyse en cours…</p>
            <p className="mt-1 text-sm text-slate-500">
              Croisement des signaux météo, trafic et historique.
            </p>
          </div>
        </div>
      )}

      {verdict && (
        <>
          <VerdictSignalsBanner signals={verdict.signals} />

          <VerdictRecommendations recommendation={verdict.recommendation} />

          <VerdictTrendsSection trends={verdict.signals.trendsSummary} />

          {expiring && (
            <VerdictExpiringSection
              perimes={expiring.perimes}
              proches={expiring.proches}
            />
          )}

          <VerdictReplenishmentSection
            aireId={aireId}
            planDate={runDate}
          />
        </>
      )}
    </div>
  );
}
