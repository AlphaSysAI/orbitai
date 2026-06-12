import { NextResponse } from "next/server";

export const LEGACY_VALIDATION_HEADER = "validation-api" as const;

/** En-têtes de dépréciation pour /api/validation/* (alias legacy). */
export function withLegacyValidationHeaders(response: NextResponse): NextResponse {
  response.headers.set("Deprecation", "true");
  response.headers.set("X-OrbitAI-Legacy", LEGACY_VALIDATION_HEADER);
  return response;
}
