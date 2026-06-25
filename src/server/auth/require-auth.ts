// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";

import { extractBearerToken } from "./tracker-token";
import {
  createServerSupabaseClient,
  createServerSupabaseClientFromRequest,
  type AuthenticatedUser,
  type ServerSupabaseClient,
} from "./supabase-server";

export type AuthUser = AuthenticatedUser;

export class AuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

const UNAUTHORIZED_MESSAGE = "Authentification requise";
const FORBIDDEN_MESSAGE = "Accès non autorisé";

async function resolveAuthUser(
  supabase: ServerSupabaseClient
): Promise<AuthUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthError(UNAUTHORIZED_MESSAGE, 401);
  }
  return {
    id: data.user.id,
    email: data.user.email ?? undefined,
  };
}

/**
 * Exige une session Supabase valide (Server Components / Route Handlers Node).
 * Utilise `getUser()` — ne se fie pas à `getSession()` seul.
 */
export async function requireAuthUser(
  supabase?: ServerSupabaseClient
): Promise<AuthUser> {
  const client = supabase ?? (await createServerSupabaseClient());
  return resolveAuthUser(client);
}

/**
 * Exige une session Supabase valide à partir d'une `Request` (Edge Route Handlers).
 */
export async function requireAuthUserFromRequest(
  request: Request
): Promise<AuthUser> {
  const client = createServerSupabaseClientFromRequest(request);
  return resolveAuthUser(client);
}

/**
 * Session Supabase optionnelle (Route Handlers) — retourne `null` si absent ou invalide.
 */
export async function getOptionalAuthUserFromRequest(
  request: Request
): Promise<AuthUser | null> {
  const client = createServerSupabaseClientFromRequest(request);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? undefined,
  };
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function getReviewPollingToken(): string | undefined {
  return (
    process.env.REVIEW_POLLING_TOKEN ??
    process.env.OPENCLAW_VALIDATION_STATUS_TOKEN
  );
}

/**
 * Vérifie le token serveur pour GET /api/review/status (polling machine).
 * Fallback OPENCLAW_VALIDATION_STATUS_TOKEN — LEGACY, supprimé Phase D.
 */
export function verifyReviewPollingToken(request: Request): boolean {
  const expected = getReviewPollingToken();
  if (!expected) return false;
  const provided = extractBearerToken(request.headers.get("authorization"));
  if (!provided) return false;
  return timingSafeEqualStrings(provided, expected);
}

/**
 * @deprecated Utiliser verifyReviewPollingToken — LEGACY OpenClaw, supprimé Phase D.
 */
export function verifyOpenClawValidationStatusToken(request: Request): boolean {
  return verifyReviewPollingToken(request);
}

/**
 * Réponse JSON 401 standard pour les Route Handlers.
 */
export function unauthorizedResponse(
  message = UNAUTHORIZED_MESSAGE
): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Réponse JSON 403 standard pour les Route Handlers.
 */
export function forbiddenResponse(message = FORBIDDEN_MESSAGE): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

/**
 * Convertit une `AuthError` en `NextResponse`, ou relance les autres erreurs.
 */
export function authErrorToResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

/**
 * Vérifie que l'identifiant ressource correspond à l'utilisateur authentifié.
 */
export function assertUserMatch(
  resourceUserId: string,
  authUserId: string
): void {
  if (resourceUserId !== authUserId) {
    throw new AuthError(FORBIDDEN_MESSAGE, 403);
  }
}

/**
 * Vérifie la propriété d'une ressource portant un champ `user_id`.
 */
export function assertOwnership(
  resource: { user_id: string },
  authUserId: string
): void {
  assertUserMatch(resource.user_id, authUserId);
}
