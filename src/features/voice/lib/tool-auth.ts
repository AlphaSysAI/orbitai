// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { timingSafeEqualStrings } from "@/server/auth/require-auth";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

export type VoiceContext = {
  orgId: string;
  db: ReturnType<typeof forWrite>;
  body: Record<string, unknown>;
  callerNumber: string | null;
};

export type VoiceResolveResult =
  | { ok: true; ctx: VoiceContext }
  | { ok: false; response: NextResponse };

function serviceClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key);
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Authentifie l'appel MACHINE de la plateforme vocale (Bearer secret partagé)
 * et résout l'organisation à partir du numéro appelé (voice_numbers). Aucun
 * identifiant d'org ne vient jamais du corps de la requête directement — il est
 * dérivé du numéro, côté serveur.
 */
export async function resolveVoiceContext(
  request: Request,
  vertical: "hotel" | "artisan"
): Promise<VoiceResolveResult> {
  const expected = process.env.VOICE_AI_TOOL_SECRET;
  if (!expected) {
    return { ok: false, response: NextResponse.json({ error: "Voice AI non configuré" }, { status: 503 }) };
  }
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!provided || !timingSafeEqualStrings(provided, expected)) {
    return { ok: false, response: unauthorized("Non autorisé") };
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Corps invalide" }, { status: 400 }) };
  }

  const calledNumber = String(body.called_number ?? body.to ?? body.phone ?? "").trim();
  if (!calledNumber) {
    return { ok: false, response: NextResponse.json({ error: "Numéro appelé manquant" }, { status: 400 }) };
  }

  const client = serviceClient();
  if (!client) {
    return { ok: false, response: NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 }) };
  }
  const db = forWrite(client);

  const { data: mapping } = await db
    .from("voice_numbers")
    .select("organization_id, vertical, is_active")
    .eq("phone_e164", calledNumber)
    .maybeSingle();

  if (!mapping || !(mapping.is_active as boolean) || (mapping.vertical as string) !== vertical) {
    return { ok: false, response: NextResponse.json({ error: "Numéro non rattaché" }, { status: 404 }) };
  }

  return {
    ok: true,
    ctx: {
      orgId: mapping.organization_id as string,
      db,
      body,
      callerNumber: String(body.caller_number ?? body.from ?? "").trim() || null,
    },
  };
}
