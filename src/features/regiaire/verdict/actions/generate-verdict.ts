"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  IsoDateSchema,
  VerdictRecommendationSchema,
  VerdictRunSchema,
  type VerdictRun,
} from "@/features/regiaire/verdict/schemas";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import { getSchoolHolidayStatus } from "@/features/regiaire/verdict/signals/school-holidays";
import {
  buildSignalsSnapshot,
  buildVerdictPromptContext,
  summarizeTrendsByCategory,
} from "@/features/regiaire/verdict/signals/summarize-for-ai";
import { getTrafficForDate } from "@/features/regiaire/verdict/signals/traffic";
import { getWeather } from "@/features/regiaire/verdict/signals/weather";
import { getStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import { buildTrendWindows } from "@/features/regiaire/verdict/trends/build-trend-windows";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type GenerateVerdictActionResult =
  | { success: true; data: VerdictRun; cached: boolean }
  | { success: false; error: string; code?: string };

const VERDICT_PROMPT = `Tu es l'assistant Verdict d'une station-service en France.
À partir des signaux résumés ci-dessous, produis une recommandation merchandising et d'affluence.

RÈGLES :
- affluence_attendue : faible | normale | forte (croise météo, vacances, trafic, jour de semaine implicite).
- rayons : une entrée par catégorie pertinente avec direction augmenter|maintenir|reduire, emphase forte|moderee|legere, justification courte citant les signaux (ex. « week-end + vacances zone C + grand soleil → boissons fraîches +30% »).
- top_mouvements : jusqu'à 5 écarts marquants vs N-1 (deltaPct si calculable).
- Si un signal est indisponible, ne l'invente pas — adapte la confiance et mentionne-le si utile.
- Réponds en français.`;

function mapVerdictRunRow(row: {
  id: string;
  organization_id: string;
  run_date: string;
  signals: unknown;
  recommendation: unknown;
  created_by: string;
  created_at: string;
}): VerdictRun {
  return VerdictRunSchema.parse({
    id: row.id,
    organizationId: row.organization_id,
    runDate: String(row.run_date),
    signals: row.signals,
    recommendation: row.recommendation,
    createdBy: row.created_by,
    createdAt: row.created_at,
  });
}

async function findCachedVerdict(
  ctx: Awaited<ReturnType<typeof requireRegiaireContext>>,
  runDate: string
): Promise<VerdictRun | null> {
  const { data, error } = await ctx.db
    .from("verdict_runs")
    .select(
      "id, organization_id, run_date, signals, recommendation, created_by, created_at"
    )
    .eq("organization_id", ctx.organizationId)
    .eq("run_date", runDate)
    .maybeSingle();

  if (error || !data) return null;
  return mapVerdictRunRow(data);
}

/**
 * Génère ou renvoie le Verdict IA du jour (cache verdict_runs par org + run_date).
 */
export async function generateVerdict(
  targetDate?: string
): Promise<GenerateVerdictActionResult> {
  try {
    const ctx = await requireRegiaireContext();
    const runDate = targetDate
      ? IsoDateSchema.parse(targetDate)
      : todayParisIso();

    const cached = await findCachedVerdict(ctx, runDate);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }

    const settings = await getStationSettings(ctx);

    const [weather, schoolHoliday, traffic, trends] = await Promise.all([
      getWeather(ctx),
      getSchoolHolidayStatus(ctx, runDate),
      getTrafficForDate(ctx, runDate),
      buildTrendWindows(ctx.organizationId, runDate, ctx),
    ]);

    const trendsSummary = summarizeTrendsByCategory(trends);
    const signalsSnapshot = buildSignalsSnapshot({
      runDate,
      settings,
      weather,
      schoolHoliday,
      traffic,
      trendsSummary,
    });

    const promptContext = buildVerdictPromptContext(signalsSnapshot);

    const { object: recommendation } = await generateObject({
      model: openai("gpt-4o"),
      schema: VerdictRecommendationSchema,
      prompt: `${VERDICT_PROMPT}\n\n--- SIGNAUX ---\n${promptContext}`,
      temperature: 0.4,
    });

    const parsedRecommendation = VerdictRecommendationSchema.parse(recommendation);

    const { data: inserted, error: insertError } = await ctx.db
      .from("verdict_runs")
      .insert({
        organization_id: ctx.organizationId,
        run_date: runDate,
        signals: signalsSnapshot,
        recommendation: parsedRecommendation,
        created_by: ctx.userId,
      })
      .select(
        "id, organization_id, run_date, signals, recommendation, created_by, created_at"
      )
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const retry = await findCachedVerdict(ctx, runDate);
        if (retry) {
          return { success: true, data: retry, cached: true };
        }
      }
      return { success: false, error: insertError.message };
    }

    if (!inserted) {
      return { success: false, error: "Insertion verdict impossible" };
    }

    return {
      success: true,
      data: mapVerdictRunRow(inserted),
      cached: false,
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la génération";
    return { success: false, error: message };
  }
}
