import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getValidationQueueItemByEventId } from "@/lib/storage";

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient<Database>(supabaseUrl, supabaseKey);
}

/**
 * GET /api/validation/status?event_id=...
 * Permet à OpenClaw (ou tout client) de vérifier si une tâche a été validée (polling).
 * Réponse: { event_id, status: "pending" | "approved" | "rejected", validated_at?, rejection_reason? }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("event_id");

  if (!eventId) {
    return NextResponse.json({ error: "event_id requis" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
  }

  const { data, error, notFound } = await getValidationQueueItemByEventId(supabase, eventId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (notFound || !data) {
    return NextResponse.json({
      event_id: eventId,
      status: "unknown",
      message: "Événement non trouvé dans la file de validation",
    });
  }

  return NextResponse.json({
    event_id: data.event_id,
    status: data.status,
    validated_at: data.validated_at ?? undefined,
    rejection_reason: data.rejection_reason ?? undefined,
  });
}
