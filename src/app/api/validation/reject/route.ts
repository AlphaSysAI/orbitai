import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  getValidationQueueItemByEventId,
  updateValidationStatus,
} from "@/lib/storage";

function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient<Database>(supabaseUrl, supabaseKey);
}

/**
 * POST /api/validation/reject
 * Body: { event_id: string, reason?: string, user_id?: string }
 * Met à jour la tâche en "rejected". Aucune entrée dans le RAG.
 */
export async function POST(req: Request) {
  let body: { event_id: string; reason?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { event_id, reason, user_id } = body;
  if (!event_id) {
    return NextResponse.json({ error: "event_id requis" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
  }

  const { data: row, error: fetchError, notFound } = await getValidationQueueItemByEventId(
    supabase,
    event_id
  );

  if (notFound || fetchError || !row) {
    return NextResponse.json(
      { error: "Tâche introuvable ou déjà traitée" },
      { status: 404 }
    );
  }
  if (row.status !== "pending") {
    return NextResponse.json(
      { error: "Tâche introuvable ou déjà traitée" },
      { status: 404 }
    );
  }

  const targetUserId = user_id ?? row.user_id;
  if (row.user_id !== targetUserId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { error: updateError } = await updateValidationStatus(supabase, row.id, "rejected", {
    rejection_reason: reason ?? undefined,
  });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, event_id });
}
