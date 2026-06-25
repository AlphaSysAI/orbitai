// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import { requireRegiaireAccess } from "@/lib/organizations/access";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import { formatEur } from "@/features/regiaire/lib/business-stats";
import { buildSecteurOverview } from "@/features/regiaire/sector-manager/actions";
import {
  SecteurVerdictRecommendationSchema,
  SecteurVerdictRunSchema,
  type SecteurVerdictRun,
} from "@/features/regiaire/verdict/secteur/schemas";

export type GenerateSecteurVerdictResult =
  | { success: true; data: SecteurVerdictRun; cached: boolean }
  | { success: false; error: string };

const SECTEUR_VERDICT_PROMPT = `Tu es directeur d'exploitation d'un réseau de stations-service autoroutières en France.
Tu supervises un SECTEUR regroupant plusieurs aires de service. Chaque jour tu produis un plan d'action consolidé pour le chef de secteur.
Objectif unique : maximiser la marge, le rendement et l'efficacité des heures travaillées sur l'ensemble du secteur.

DIRECTIVES :
- synthese : état du secteur en 1 paragraphe (max 900 car.) — performance globale, points forts, points de vigilance, opportunité prioritaire.
- plan_action : 3 à 6 actions priorisées (critique/haute/normale). Chaque action : titre court + detail concret (qui fait quoi) + impact_estime chiffré si possible (€/marge/heures) + aire_cible (nom de l'aire concernée, ou null si transverse).
- leviers_marge : 2 à 4 leviers concrets pour augmenter la marge (réassort, péremption, mix produit).
- leviers_rendement : 2 à 4 leviers pour optimiser rendement / heures (planning équipe, taux de complétion des quarts, livraisons).
- alertes : risques immédiats (périmés, quarts non clôturés, livraisons bloquées). Liste vide si rien.
- Travaille uniquement avec les données fournies, ne fabrique rien. Réponds entièrement en français.`;

function buildPromptContext(
  overview: Awaited<ReturnType<typeof buildSecteurOverview>>
): string {
  const lines: string[] = [];
  lines.push(`SECTEUR : ${overview.secteurName}`);
  lines.push(`Nombre d'aires : ${overview.aires.length}`);
  lines.push(
    `Économies totales estimées : ${formatEur(overview.totals.totalSavingsEur)} · Heures réception économisées : ${overview.totals.receptionHoursSaved} · Périmés J+3 : ${overview.totals.expiringCount} lots · Livraisons en cours : ${overview.totals.inProgressCount}`
  );
  lines.push("");
  for (const aire of overview.aires) {
    const todayDone = aire.todayClosures.length;
    const avgCompletion =
      aire.recentClosures.length > 0
        ? Math.round(
            aire.recentClosures.reduce((s, c) => s + c.completionPct, 0) /
              aire.recentClosures.length
          )
        : null;
    lines.push(
      `— ${aire.name}${aire.city ? ` (${aire.city})` : ""} : économies ${formatEur(aire.savings.totalSavingsEur)}, périmés J+3 ${aire.expiringCount}, livraisons en cours ${aire.inProgressCount}, quarts clôturés aujourd'hui ${todayDone}/3${avgCompletion !== null ? `, complétion moyenne 7j ${avgCompletion}%` : ", aucune clôture récente"}`
    );
  }
  return lines.join("\n");
}

export async function generateSecteurVerdict(
  secteurId: string,
  force = false
): Promise<GenerateSecteurVerdictResult> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) return { success: false, error: "Module non activé" };

    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    const { data: secteur } = await db
      .from("secteurs")
      .select("id, name, organization_id")
      .eq("id", secteurId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();

    if (!secteur) return { success: false, error: "Secteur introuvable" };

    const runDate = todayParisIso();

    if (!force) {
      const { data: cached } = await db
        .from("secteur_verdict_runs")
        .select("id, secteur_id, organization_id, run_date, recommendation, created_at")
        .eq("secteur_id", secteurId)
        .eq("run_date", runDate)
        .maybeSingle();

      if (cached) {
        return {
          success: true,
          cached: true,
          data: SecteurVerdictRunSchema.parse({
            id: cached.id,
            secteurId: cached.secteur_id,
            organizationId: cached.organization_id,
            runDate: String(cached.run_date),
            recommendation: cached.recommendation,
            createdAt: cached.created_at,
          }),
        };
      }
    }

    const overview = await buildSecteurOverview(
      db,
      access.organizationId,
      secteur.id as string,
      secteur.name as string
    );

    const { object: recommendation } = await generateObject({
      model: openai("gpt-4o"),
      schema: SecteurVerdictRecommendationSchema,
      prompt: `${SECTEUR_VERDICT_PROMPT}\n\n--- DONNÉES SECTEUR ---\n${buildPromptContext(overview)}`,
      temperature: 0.5,
    });

    const parsed = SecteurVerdictRecommendationSchema.parse(recommendation);

    const { data: inserted, error: insertError } = await db
      .from("secteur_verdict_runs")
      .upsert(
        {
          organization_id: access.organizationId,
          secteur_id: secteurId,
          run_date: runDate,
          signals: {},
          recommendation: parsed,
          created_by: user.id,
        },
        { onConflict: "secteur_id,run_date" }
      )
      .select("id, secteur_id, organization_id, run_date, recommendation, created_at")
      .single();

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message ?? "Insertion impossible" };
    }

    return {
      success: true,
      cached: false,
      data: SecteurVerdictRunSchema.parse({
        id: inserted.id,
        secteurId: inserted.secteur_id,
        organizationId: inserted.organization_id,
        runDate: String(inserted.run_date),
        recommendation: inserted.recommendation,
        createdAt: inserted.created_at,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur de génération";
    return { success: false, error: message };
  }
}
