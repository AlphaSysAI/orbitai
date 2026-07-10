// Copyright © 2026 OrbitSys. Tous droits réservés.

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Rate-limiting des appels IA — protège le budget OpenAI et limite la surface
 * de DoS. S'appuie sur le RPC Postgres `rate_limit_check` (migration 046),
 * compteur atomique partagé entre toutes les instances serverless.
 *
 * Alternative envisageable : Upstash Ratelimit (Redis). Écarté ici pour éviter
 * une dépendance/infra externe alors que Supabase est déjà présent et suffisant.
 */

export class AiRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Limite de requêtes IA atteinte. Merci de réessayer dans un instant.");
    this.name = "AiRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type RateLimitRule = { limit: number; windowSeconds: number };

/**
 * Barèmes par famille d'usage. Volontairement conservateurs : un poste de
 * travail légitime reste largement sous le plafond, un script abusif est stoppé.
 */
export const AI_RATE_LIMITS = {
  /** Verdict IA (station) : coûteux, mais consulté plusieurs fois/jour. */
  verdict: { limit: 15, windowSeconds: 60 },
  /** Extraction de BL (vision) : la plus coûteuse en tokens. */
  bl: { limit: 12, windowSeconds: 60 },
  /** Génération de devis Artisan. */
  quote: { limit: 20, windowSeconds: 60 },
  /** Chat / streaming (add-ons). */
  chat: { limit: 30, windowSeconds: 60 },
  /** Traitements lourds ponctuels (analyse historique, imports). */
  heavy: { limit: 10, windowSeconds: 60 },
  /** Défaut prudent pour tout endpoint IA non spécifié. */
  default: { limit: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * Vérifie le quota pour `scope:identifier`. Lève `AiRateLimitError` si dépassé.
 *
 * Politique de défaillance : **fail-open** sur erreur d'infrastructure (RPC
 * indisponible) — on ne bloque pas le trafic légitime pour un incident DB. Le
 * plafond OpenAI reste le garde-fou de dernier recours.
 *
 * @param db   client Supabase (RLS user pour les Server Actions, ou client de
 *             requête pour les Route Handlers) — le RPC est SECURITY DEFINER.
 * @param scope famille d'usage (ex. "verdict", "bl", "chat").
 * @param identifier clé de comptage (user_id, org_id, ou IP en repli).
 */
export async function enforceAiRateLimit(
  db: SupabaseClient,
  scope: string,
  identifier: string,
  rule: RateLimitRule = AI_RATE_LIMITS.default
): Promise<void> {
  const bucket = `${scope}:${identifier}`;
  try {
    const { data, error } = await db.rpc("rate_limit_check", {
      p_bucket: bucket,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) {
      console.error(`[rate-limit] RPC en échec (fail-open) pour ${bucket}:`, error.message);
      return;
    }
    if (data === false) {
      throw new AiRateLimitError(rule.windowSeconds);
    }
  } catch (err) {
    if (err instanceof AiRateLimitError) throw err;
    console.error(`[rate-limit] exception (fail-open) pour ${bucket}:`, err);
  }
}

/**
 * Extrait une IP cliente exploitable comme clé de repli quand aucun `userId`
 * fiable n'est disponible (routes edge sans session).
 */
export function clientIpFromRequest(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
