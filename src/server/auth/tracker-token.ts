// Copyright © 2026 OrbitSys. Tous droits réservés.

export const TRACKER_TOKEN_VERSION = 1 as const;
export const TRACKER_TOKEN_PREFIX = "orbit_tracker_v1" as const;

/** Durée de vie par défaut : 90 jours */
export const TRACKER_TOKEN_DEFAULT_TTL_SECONDS = 90 * 24 * 60 * 60;

export type TrackerTokenPayload = {
  userId: string;
  exp: number;
  version: typeof TRACKER_TOKEN_VERSION;
};

export type VerifiedTrackerToken = TrackerTokenPayload;

export class TrackerTokenError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "TrackerTokenError";
    this.status = status;
  }
}

function getTrackerSigningSecret(): string {
  const secret = process.env.TRACKER_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new TrackerTokenError(
      "Configuration serveur invalide: TRACKER_SIGNING_SECRET manquant ou trop court (min. 32 caractères).",
      500
    );
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(encoded: string): Uint8Array {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

function serializePayload(payload: TrackerTokenPayload): string {
  return JSON.stringify({
    userId: payload.userId,
    exp: payload.exp,
    version: payload.version,
  });
}

function parsePayload(raw: string): TrackerTokenPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TrackerTokenError("Token tracker invalide: payload illisible.");
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof record.userId !== "string" ||
    typeof record["exp"] !== "number" ||
    record.version !== TRACKER_TOKEN_VERSION
  ) {
    throw new TrackerTokenError("Token tracker invalide: structure incorrecte.");
  }

  const userId = record.userId as string;
  const exp = record["exp"] as number;
  const version = record.version as typeof TRACKER_TOKEN_VERSION;
  if (!userId.trim()) {
    throw new TrackerTokenError("Token tracker invalide: userId manquant.");
  }
  if (!Number.isFinite(exp) || exp <= 0) {
    throw new TrackerTokenError("Token tracker invalide: expiration incorrecte.");
  }

  return { userId, exp, version };
}

export type SignTrackerTokenOptions = {
  /** Durée de validité en secondes (défaut 90 jours) */
  ttlSeconds?: number;
};

/**
 * Signe un token tracker HMAC pour le script d'activité Python.
 * Format : orbit_tracker_v1.<payload_b64url>.<signature_b64url>
 */
export async function signTrackerToken(
  userId: string,
  options?: SignTrackerTokenOptions
): Promise<string> {
  if (!userId.trim()) {
    throw new TrackerTokenError("userId requis pour signer un token tracker.", 400);
  }

  const secret = getTrackerSigningSecret();
  const ttlSeconds = options?.ttlSeconds ?? TRACKER_TOKEN_DEFAULT_TTL_SECONDS;
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;

  const payload: TrackerTokenPayload = {
    userId,
    exp,
    version: TRACKER_TOKEN_VERSION,
  };

  const payloadJson = serializePayload(payload);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payloadJson));
  const signature = await hmacSha256(secret, payloadB64);
  const signatureB64 = base64UrlEncode(signature);

  return `${TRACKER_TOKEN_PREFIX}.${payloadB64}.${signatureB64}`;
}

/**
 * Vérifie un token tracker : prefix, signature HMAC, structure et expiration.
 */
export async function verifyTrackerToken(token: string): Promise<VerifiedTrackerToken> {
  if (!token.trim()) {
    throw new TrackerTokenError("Token tracker manquant.");
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TRACKER_TOKEN_PREFIX) {
    throw new TrackerTokenError("Token tracker invalide: format incorrect.");
  }

  const payloadB64 = parts[1];
  const signatureB64 = parts[2];
  if (!payloadB64 || !signatureB64) {
    throw new TrackerTokenError("Token tracker invalide: segments manquants.");
  }

  const secret = getTrackerSigningSecret();
  const expectedSignature = await hmacSha256(secret, payloadB64);
  const providedSignature = base64UrlDecode(signatureB64);

  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    throw new TrackerTokenError("Token tracker invalide: signature incorrecte.");
  }

  const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
  const payload = parsePayload(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (payload["exp"] <= now) {
    throw new TrackerTokenError("Token tracker expiré.");
  }

  return payload;
}

/**
 * Extrait le token depuis l'en-tête Authorization: Bearer ...
 */
export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match?.[1]?.trim() ?? null;
}
