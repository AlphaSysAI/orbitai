import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  getValidationQueueItem,
  updateValidationStatus,
  upsertAgentActionIndex,
} from "@/lib/storage";

export const runtime = "nodejs";

type ValidateBody = {
  task_id: string;
  status: "approved" | "rejected";
  user_id?: string;
  rejection_reason?: string;
};

/**
 * POST /api/tasks/validate
 * Body: { task_id: string, status: "approved" | "rejected", user_id?: string, rejection_reason?: string }
 * Met à jour validation_queue (DB). Le worker sondera la base pour exécuter les tâches approuvées (executed_at).
 */
export async function POST(req: Request) {
  let body: ValidateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }

  const { task_id, status, user_id: bodyUserId, rejection_reason } = body;
  if (!task_id || !status) {
    return NextResponse.json(
      { error: "task_id et status requis" },
      { status: 400 }
    );
  }
  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "status doit être approved ou rejected" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Configuration Supabase manquante" }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  const { data: row, error: fetchError } = await getValidationQueueItem(supabase, task_id);

  if (fetchError || !row) {
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

  const requestUserId = bodyUserId ?? row.user_id;
  if (row.user_id !== requestUserId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { error: updateError } = await updateValidationStatus(supabase, task_id, status, {
    validated_by: requestUserId,
    rejection_reason: status === "rejected" ? rejection_reason ?? undefined : undefined,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (status === "approved") {
    const fullText = `Action: ${row.action}\nRationale: ${row.rationale}\nPayload: ${JSON.stringify(row.payload)}`;
    const { error: insertError } = await upsertAgentActionIndex(supabase, {
      event_id: row.event_id,
      user_id: row.user_id,
      action: row.action,
      status: "approved",
      payload: row.payload ?? {},
      rationale: row.rationale ?? "",
      full_text: fullText,
    });
    if (insertError) {
      console.error("[tasks/validate] agent_actions_index insert failed:", insertError.message);
      return NextResponse.json(
        { error: "Statut mis à jour mais indexation RAG échouée: " + insertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, task_id, status });
}
