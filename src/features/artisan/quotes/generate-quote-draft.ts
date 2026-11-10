// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { generateObject } from "ai";

import { getModel, aiTimeoutSignal } from "@/lib/ai/model";
import {
  enforceAiRateLimit,
  AI_RATE_LIMITS,
  AiRateLimitError,
} from "@/lib/ai/rate-limit";
import { requireArtisanAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import { QuoteDraftSchema, type QuoteDraft } from "@/features/artisan/quotes/schemas";

export type GenerateQuoteDraftResult =
  | { success: true; data: QuoteDraft }
  | { success: false; error: string };

const SYSTEM_PROMPT = `Tu es un expert en chiffrage pour artisans du bâtiment en France.
Analyse la demande du client et extrais un brouillon de devis structuré.
N'invente pas de matériaux absents de la demande : si aucun matériau n'est mentionné, retourne materials vide.
Pour catalog_service_titles, choisis uniquement parmi les titres du catalogue fourni (orthographe proche acceptée).
Pour labor_items, hours = heures estimées, hourly_rate_eur = taux horaire suggéré en euros.
notes : synthèse courte pour le devis (max 500 caractères). Réponds en français.`;

/**
 * Génère un brouillon de devis à partir de la demande client saisie par
 * l'artisan (OpenAI GPT-4o). Lecture seule : ne persiste rien — l'artisan
 * valide/ajuste puis enregistre côté UI.
 */
export async function generateQuoteDraft(
  requestText: string
): Promise<GenerateQuoteDraftResult> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const text = requestText.trim();
    if (text.length < 10) {
      return { success: false, error: "Décrivez la demande du client (10 caractères minimum)." };
    }

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    // Garde-fou budgétaire/DoS avant l'appel IA (par organisation).
    await enforceAiRateLimit(db, "quote", access.organizationId, AI_RATE_LIMITS.quote);

    const [{ data: profile }, { data: services }] = await Promise.all([
      db
        .from("artisan_profiles")
        .select("business_name, description, labor_rate_per_hour")
        .eq("organization_id", access.organizationId)
        .maybeSingle(),
      db
        .from("artisan_services")
        .select("title, duration")
        .eq("organization_id", access.organizationId)
        .order("title", { ascending: true }),
    ]);

    const laborRateEur =
      profile?.labor_rate_per_hour != null
        ? (profile.labor_rate_per_hour / 100).toFixed(2)
        : "non renseigné";

    const catalogList =
      services && services.length > 0
        ? services.map((s) => `- ${s.title} (${s.duration} min)`).join("\n")
        : "(aucune prestation configurée)";

    const userPrompt = `Artisan : ${profile?.business_name ?? "—"}
${profile?.description ? `Description : ${profile.description}` : ""}
Taux horaire artisan : ${laborRateEur} €/h

Catalogue prestations disponibles :
${catalogList}

Demande du client :
${text}`;

    const { object } = await generateObject({
      model: getModel(),
      schema: QuoteDraftSchema,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      abortSignal: aiTimeoutSignal(),
    });

    return { success: true, data: object };
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return { success: false, error: error.message };
    }
    console.error("[generateQuoteDraft] échec génération devis:", error);
    const message = error instanceof Error ? error.message : "Erreur génération devis";
    return { success: false, error: message };
  }
}
