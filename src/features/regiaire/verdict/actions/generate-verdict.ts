// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { generateObject } from "ai";

import { getModel, aiTimeoutSignal } from "@/lib/ai/model";
import {
  enforceAiRateLimit,
  AI_RATE_LIMITS,
  AiRateLimitError,
} from "@/lib/ai/rate-limit";
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
import { getBisonFuteForecast } from "@/features/regiaire/verdict/signals/bison-fute";
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

const VERDICT_PROMPT = `Tu es le directeur commercial d'une station-service autoroutière en France.
Chaque matin tu produis un briefing Verdict pour le responsable de point de vente.
Ton unique objectif : maximiser le chiffre d'affaires et la marge brute du jour.

DIRECTIVES :
- Parle en directeur : chiffres, impact CA estimé, marge, décisions concrètes. Jamais de vague.
- affluence_attendue : faible | normale | forte. Bison Futé rouge/noir → forte ; croise météo, vacances scolaires, historique, jour de semaine.
- rayons : une ligne par catégorie pertinente. justification détaillée (max 500 car.) citant les signaux chiffrés. impact_estime obligatoire : quantifie l'opportunité (ex. « +20% CA boissons soit ~180€ sur la journée »).
- top_mouvements : 3 à 5 écarts vs N-1, deltaPct si disponible, justification orientée impact business.
- synthese : synthèse exécutive (max 1200 car.) — situation du jour, fenêtre d'opportunité, impact global CA/marge attendu. Ton synthétique mais précis.
- directeur_briefing : briefing matinal détaillé (max 2000 car.) — analyse du contexte, risques opérationnels, leviers de performance du jour, décisions à prendre avant ouverture. Style briefing DG : factuel, direct, orienté résultat.
- opportunites_roi : 2 à 4 opportunités chiffrées et priorisées (critique/haute/normale). Action spécifique + impact estimé en CA.
- actions_immediates : 3 à 5 actions concrètes à exécuter maintenant (réassort, mise en avant, prix, placement). Verbe d'action + objet + mesure.
- Si un signal est indisponible, travaille avec les données restantes et l'indique brièvement. Ne fabrique pas de données.
- Réponds entièrement en français.`;

function parseStoredRecommendation(raw: unknown) {
  const rec =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  // Rétro-compat : inject les champs nullable ajoutés après la v1
  const rayons = Array.isArray(rec.rayons)
    ? rec.rayons.map((r: unknown) => {
        if (r && typeof r === "object") {
          const rayon = r as Record<string, unknown>;
          return { ...rayon, impact_estime: rayon.impact_estime ?? null };
        }
        return r;
      })
    : rec.rayons;

  return VerdictRecommendationSchema.parse({
    ...rec,
    rayons,
    synthese: rec.synthese ?? null,
    directeur_briefing: rec.directeur_briefing ?? null,
    opportunites_roi: rec.opportunites_roi ?? null,
    actions_immediates: rec.actions_immediates ?? null,
  });
}

function parseStoredSignals(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  const s = raw as Record<string, unknown>;
  const weather =
    s.weather && typeof s.weather === "object"
      ? (s.weather as Record<string, unknown>)
      : null;
  const schoolHoliday =
    s.schoolHoliday && typeof s.schoolHoliday === "object"
      ? (s.schoolHoliday as Record<string, unknown>)
      : null;
  const traffic =
    s.traffic && typeof s.traffic === "object"
      ? (s.traffic as Record<string, unknown>)
      : null;
  const bisonFute =
    s.bisonFute && typeof s.bisonFute === "object"
      ? (s.bisonFute as Record<string, unknown>)
      : null;

  return {
    ...s,
    weather: weather
      ? {
          ...weather,
          forecast: weather.forecast ?? null,
          reason: weather.reason ?? null,
        }
      : weather,
    schoolHoliday: schoolHoliday
      ? {
          ...schoolHoliday,
          status: schoolHoliday.status ?? null,
          reason: schoolHoliday.reason ?? null,
        }
      : schoolHoliday,
    traffic: traffic
      ? {
          ...traffic,
          footfallIndex: traffic.footfallIndex ?? null,
          reason: traffic.reason ?? null,
        }
      : traffic,
    bisonFute: bisonFute
      ? {
          ...bisonFute,
          zone: bisonFute.zone ?? null,
          level: bisonFute.level ?? null,
          levelAller: bisonFute.levelAller ?? null,
          levelRetour: bisonFute.levelRetour ?? null,
          reason: bisonFute.reason ?? null,
        }
      : {
          available: false,
          signalDate: s.runDate ?? todayParisIso(),
          zone: null,
          level: null,
          levelAller: null,
          levelRetour: null,
          reason: "Signal absent (cache antérieur)",
        },
  };
}

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
    signals: parseStoredSignals(row.signals),
    recommendation: parseStoredRecommendation(row.recommendation),
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
    .eq("aire_id", ctx.aireId)
    .eq("run_date", runDate)
    .maybeSingle();

  if (error || !data) return null;
  return mapVerdictRunRow(data);
}

type RegiaireCtx = Awaited<ReturnType<typeof requireRegiaireContext>>;

/**
 * Déduplication anti-« thundering herd » : coalesce les calculs concurrents du
 * même verdict (même aire + date) au sein d'une instance serverless, pour éviter
 * des appels GPT-4o payants en double. La contrainte d'unicité de `verdict_runs`
 * couvre en complément la course inter-instances (plus rare).
 */
const inFlightVerdicts = new Map<string, Promise<VerdictRun>>();

/** Calcule les signaux, appelle l'IA et persiste le verdict. Lève en cas d'échec. */
async function computeAndStoreVerdict(
  ctx: RegiaireCtx,
  runDate: string
): Promise<VerdictRun> {
  const settings = await getStationSettings(ctx);

  const [weather, schoolHoliday, traffic, bisonFute, trends] = await Promise.all([
    getWeather(ctx),
    getSchoolHolidayStatus(ctx, runDate),
    getTrafficForDate(ctx, runDate),
    getBisonFuteForecast(ctx, runDate),
    buildTrendWindows(ctx.organizationId, runDate, ctx),
  ]);

  const trendsSummary = summarizeTrendsByCategory(trends);
  const signalsSnapshot = buildSignalsSnapshot({
    runDate,
    settings,
    weather,
    schoolHoliday,
    traffic,
    bisonFute,
    trendsSummary,
  });

  const promptContext = buildVerdictPromptContext(signalsSnapshot);

  const { object: recommendation } = await generateObject({
    model: getModel(),
    schema: VerdictRecommendationSchema,
    prompt: `${VERDICT_PROMPT}\n\n--- SIGNAUX ---\n${promptContext}`,
    temperature: 0.55,
    abortSignal: aiTimeoutSignal(),
  });

  const parsedRecommendation = VerdictRecommendationSchema.parse({
    ...recommendation,
    synthese: recommendation.synthese ?? null,
  });

  const { data: inserted, error: insertError } = await ctx.db
    .from("verdict_runs")
    .insert({
      organization_id: ctx.organizationId,
      aire_id: ctx.aireId,
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
    // Course inter-instances : un autre process a déjà écrit le verdict du jour.
    if (insertError.code === "23505") {
      const retry = await findCachedVerdict(ctx, runDate);
      if (retry) return retry;
    }
    throw new Error(insertError.message);
  }

  if (!inserted) {
    throw new Error("Insertion verdict impossible");
  }

  return mapVerdictRunRow(inserted);
}

/**
 * Génère ou renvoie le Verdict IA du jour (cache verdict_runs par org + run_date).
 */
export async function generateVerdict(
  aireId: string,
  targetDate?: string
): Promise<GenerateVerdictActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const runDate = targetDate
      ? IsoDateSchema.parse(targetDate)
      : todayParisIso();

    const cached = await findCachedVerdict(ctx, runDate);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }

    // Garde-fou budgétaire/DoS avant tout appel IA (par utilisateur).
    await enforceAiRateLimit(ctx.db, "verdict", ctx.userId, AI_RATE_LIMITS.verdict);

    // Coalescing : un seul calcul IA par aire+date en vol simultanément.
    const key = `${ctx.aireId}:${runDate}`;
    let inflight = inFlightVerdicts.get(key);
    if (!inflight) {
      inflight = computeAndStoreVerdict(ctx, runDate).finally(() => {
        inFlightVerdicts.delete(key);
      });
      inFlightVerdicts.set(key, inflight);
    }

    const data = await inflight;
    return { success: true, data, cached: false };
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return { success: false, error: error.message, code: "rate_limited" };
    }
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la génération";
    return { success: false, error: message };
  }
}
