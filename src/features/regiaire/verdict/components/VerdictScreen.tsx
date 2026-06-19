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
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 pb-16 sm:py-8">
      <header className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600/20">
            <Brain className="text-amber-400" size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
              Verdict IA
              {aireName ? ` · ${aireName}` : ""}
            </p>
            {runDate && (
              <h1 className="mt-1 text-xl font-extrabold capitalize leading-tight tracking-tight text-white sm:text-2xl">
                {formatVerdictDate(runDate)}
              </h1>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <OrderDayBadge show={Boolean(isOrderDay)} />
              {isCached && verdict && (
                <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Cache du jour
                </span>
              )}
            </div>
          </div>
        </div>

        {affluenceCfg && affluence && (
          <div
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${affluenceCfg.className}`}
          >
            <span
              className={`h-3 w-3 shrink-0 rounded-full ${affluenceCfg.dotClass}`}
            />
            <p className="text-sm font-black uppercase tracking-wider">
              {affluenceCfg.label}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white hover:bg-amber-500 disabled:opacity-50 sm:flex-none"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Générer le Verdict du jour
          </button>
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isGenerating || !verdict}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-300 hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50"
          >
            <RefreshCw size={14} />
            Régénérer
          </button>
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}
      </header>

      {isGenerating && !verdict && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-600/5 py-16">
          <Loader2 className="animate-spin text-amber-400" size={32} />
          <p className="text-sm text-slate-400">
            Analyse des signaux et génération IA…
          </p>
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
        </>
      )}
    </div>
  );
}
