// Copyright © 2026 OrbitSys. Tous droits réservés.

import {
  enforceAiRateLimit,
  clientIpFromRequest,
  AI_RATE_LIMITS,
  type RateLimitRule,
} from "@/lib/ai/rate-limit";
import { getOptionalAuthUserFromRequest } from "@/server/auth/require-auth";
import { createServerSupabaseClientFromRequest } from "@/server/auth/supabase-server";

/**
 * Applique le rate-limiting IA dans un Route Handler.
 *
 * Choix de la clé de comptage, par ordre de préférence :
 *  1. `identifier` explicite (ex. `userId` du corps de requête),
 *  2. utilisateur authentifié (cookie de session),
 *  3. IP cliente (repli).
 *
 * Le client Supabase est construit depuis la requête (lecture seule) ; le RPC
 * `rate_limit_check` étant SECURITY DEFINER, un client anon suffit.
 */
export async function enforceAiRateLimitForRequest(
  request: Request,
  scope: string,
  opts: { rule?: RateLimitRule; identifier?: string } = {}
): Promise<void> {
  const db = createServerSupabaseClientFromRequest(request);

  let identifier = opts.identifier?.trim();
  if (!identifier) {
    const user = await getOptionalAuthUserFromRequest(request);
    identifier = user?.id ?? clientIpFromRequest(request);
  }

  await enforceAiRateLimit(db, scope, identifier, opts.rule ?? AI_RATE_LIMITS.default);
}

export { AiRateLimitError, AI_RATE_LIMITS } from "@/lib/ai/rate-limit";
