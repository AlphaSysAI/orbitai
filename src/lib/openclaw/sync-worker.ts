// Copyright © 2026 OrbitSys. Tous droits réservés.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  fetchApprovedTasksPendingExecution,
  fetchUnprocessedInboxAgentLogs,
  fetchUnprocessedInboxReports,
  fetchUnprocessedInboxValidation,
  getAutomationPolicy,
  getSkillByActionType,
  insertDailyReport,
  markInboxAgentLogProcessed,
  markInboxReportProcessed,
  markInboxValidationProcessed,
  setValidationQueueExecuted,
  upsertAgentActionIndex,
  upsertToValidationQueue,
} from "@/lib/storage";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Construire le texte indexable pour le RAG à partir des champs d'un événement */
function buildFullTextForRAG(action: string, rationale: string, payload: Record<string, unknown>): string {
  return `Action: ${action}\nRationale: ${rationale}\nPayload: ${JSON.stringify(payload)}`;
}

export type ProcessInboxReportsResult = {
  processed: number;
  errors: string[];
};

/**
 * Traite les rapports en attente depuis inbox_reports : insertion dans daily_reports puis marquage traité.
 */
export async function processInboxReportsFromDb(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<ProcessInboxReportsResult> {
  const result: ProcessInboxReportsResult = { processed: 0, errors: [] };
  const { data: rows, error: fetchError } = await fetchUnprocessedInboxReports(supabase);

  if (fetchError) {
    result.errors.push(`fetchUnprocessedInboxReports: ${fetchError.message}`);
    return result;
  }

  for (const row of rows) {
    const { error: insertError } = await insertDailyReport(supabase, {
      user_id: row.user_id,
      report_date: row.report_date,
      summary: row.summary,
      events: row.events,
      metadata: row.metadata ?? {},
    });
    if (insertError) {
      result.errors.push(`inbox_report ${row.id}: insert daily_reports – ${insertError.message}`);
      continue;
    }
    const { error: markError } = await markInboxReportProcessed(supabase, row.id);
    if (markError) result.errors.push(`inbox_report ${row.id}: mark processed – ${markError.message}`);
    result.processed++;
  }
  return result;
}

export type ProcessInboxValidationResult = {
  processed: number;
  errors: string[];
};

/**
 * Traite les demandes de validation en attente depuis inbox_validation : upsert dans ai_review_queue puis marquage traité.
 */
export async function processInboxValidationFromDb(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<ProcessInboxValidationResult> {
  const result: ProcessInboxValidationResult = { processed: 0, errors: [] };
  const { data: rows, error: fetchError } = await fetchUnprocessedInboxValidation(supabase);

  if (fetchError) {
    result.errors.push(`fetchUnprocessedInboxValidation: ${fetchError.message}`);
    return result;
  }

  for (const row of rows) {
    const { error: upsertError } = await upsertToValidationQueue(supabase, {
      event_id: row.event_id,
      user_id: row.user_id,
      action: row.action,
      payload: row.payload ?? {},
      rationale: row.rationale ?? "",
      human_input_required: row.human_input_required ?? true,
      status: "pending",
    });
    if (upsertError) {
      result.errors.push(`inbox_validation ${row.id}: upsert ai_review_queue – ${upsertError.message}`);
      continue;
    }
    const { error: markError } = await markInboxValidationProcessed(supabase, row.id);
    if (markError) result.errors.push(`inbox_validation ${row.id}: mark processed – ${markError.message}`);
    result.processed++;
  }
  return result;
}

export type ProcessInboxAgentLogsResult = {
  executedIndexed: number;
  pendingEnqueued: number;
  skipped: number;
  errors: string[];
};

/**
 * Traite les événements agent en attente depuis inbox_agent_logs : dispatch vers agent_actions_index ou ai_review_queue.
 */
export async function processInboxAgentLogsFromDb(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<ProcessInboxAgentLogsResult> {
  const result: ProcessInboxAgentLogsResult = {
    executedIndexed: 0,
    pendingEnqueued: 0,
    skipped: 0,
    errors: [],
  };
  const { data: rows, error: fetchError } = await fetchUnprocessedInboxAgentLogs(supabase);

  if (fetchError) {
    result.errors.push(`fetchUnprocessedInboxAgentLogs: ${fetchError.message}`);
    return result;
  }

  for (const row of rows) {
    if (row.status === "executed") {
      const fullText = buildFullTextForRAG(row.action, row.rationale, row.payload ?? {});
      const { error } = await upsertAgentActionIndex(supabase, {
        event_id: row.event_id,
        user_id: row.user_id,
        action: row.action,
        status: "executed",
        payload: row.payload ?? {},
        rationale: row.rationale ?? "",
        full_text: fullText,
      });
      if (error) {
        result.errors.push(`inbox_agent_log ${row.id}: agent_actions_index – ${error.message}`);
      } else {
        result.executedIndexed++;
      }
    } else if (row.status === "pending_validation") {
      const { data: policy } = await getAutomationPolicy(supabase, row.user_id, row.action);
      if (policy?.status === "ENABLED") {
        const fullText = buildFullTextForRAG(row.action, row.rationale, row.payload ?? {});
        const { error: autoErr } = await upsertAgentActionIndex(supabase, {
          event_id: row.event_id,
          user_id: row.user_id,
          action: row.action,
          status: "auto_approved",
          payload: row.payload ?? {},
          rationale: row.rationale ?? "",
          full_text: fullText,
        });
        if (autoErr) {
          result.errors.push(`inbox_agent_log ${row.id}: auto_approved – ${autoErr.message}`);
        } else {
          console.log(`[Auto-Pilot] Action [${row.action}] exécutée automatiquement.`);
          result.executedIndexed++;
        }
      } else {
        const { error } = await upsertToValidationQueue(supabase, {
          event_id: row.event_id,
          user_id: row.user_id,
          action: row.action,
          payload: row.payload ?? {},
          rationale: row.rationale ?? "",
          human_input_required: row.human_input_required ?? true,
          status: "pending",
          raw_log_line: row.raw_line,
        });
        if (error) {
          result.errors.push(`inbox_agent_log ${row.id}: ai_review_queue – ${error.message}`);
        } else {
          result.pendingEnqueued++;
        }
      }
    } else {
      result.skipped++;
    }

    const { error: markError } = await markInboxAgentLogProcessed(supabase, row.id);
    if (markError) result.errors.push(`inbox_agent_log ${row.id}: mark processed – ${markError.message}`);
  }
  return result;
}

/**
 * Exécute l'action approuvée en s'appuyant sur le skill en base (skill_manifests) si présent.
 */
async function executeApprovedAction(
  supabase: ReturnType<typeof createClient<Database>>,
  action: string,
  payload: Record<string, unknown>,
  context: { taskId: string; eventId: string; userId: string }
): Promise<void> {
  const { data: skill } = await getSkillByActionType(supabase, action);
  const procedurePayload = skill?.payload ?? {};
  const mergedPayload = { ...procedurePayload, ...payload };

  if (process.env.NODE_ENV !== "production") {
    console.log("[openclaw] Action approuvée exécutée:", {
      action,
      hasSkill: !!skill,
      skillId: skill?.id,
      payload: mergedPayload,
      context,
    });
  }
  // Le dispatcher peut interpréter mergedPayload (ex. webhook, script) sans changement de code
}

export type ProcessApprovedTasksResult = {
  executed: number;
  errors: string[];
};

/**
 * Consomme les tâches approuvées non encore exécutées (remplace lecture outbox fichier).
 * Récupère depuis ai_review_queue (status=approved, published_at IS NULL), exécute l'action, marque published_at.
 */
export async function processApprovedTasksFromDb(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<ProcessApprovedTasksResult> {
  const result: ProcessApprovedTasksResult = { executed: 0, errors: [] };
  const { data: rows, error: fetchError } = await fetchApprovedTasksPendingExecution(supabase);

  if (fetchError) {
    result.errors.push(`fetchApprovedTasksPendingExecution: ${fetchError.message}`);
    return result;
  }

  for (const row of rows) {
    try {
      const payload = (row.payload as Record<string, unknown>) ?? {};
      await executeApprovedAction(supabase, row.action, payload, {
        taskId: row.id,
        eventId: row.event_id,
        userId: row.user_id,
      });
      const { error: setError } = await setValidationQueueExecuted(supabase, row.id);
      if (setError) {
        result.errors.push(`task ${row.id}: setValidationQueueExecuted – ${setError.message}`);
      } else {
        result.executed++;
      }
    } catch (e) {
      result.errors.push(`task ${row.id}: executeApprovedAction – ${String(e)}`);
    }
  }
  return result;
}

export type RunOpenClawSyncResult = {
  inboxReportsProcessed: number;
  inboxValidationProcessed: number;
  inboxAgentLogsExecuted: number;
  inboxAgentLogsPending: number;
  inboxAgentLogsSkipped: number;
  approvedTasksExecuted: number;
  errors: string[];
};

/**
 * Worker de synchronisation 100 % database-driven.
 * Sond la base (inbox_*, ai_review_queue) au lieu du système de fichiers.
 * Aucune donnée ne transite par le disque local.
 */
export async function runOpenClawSync(): Promise<RunOpenClawSyncResult> {
  const errors: string[] = [];
  let inboxReportsProcessed = 0;
  let inboxValidationProcessed = 0;
  let inboxAgentLogsExecuted = 0;
  let inboxAgentLogsPending = 0;
  let inboxAgentLogsSkipped = 0;
  let approvedTasksExecuted = 0;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY) required for sync.");
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  // 1. Inbox rapports → daily_reports
  try {
    const reportsResult = await processInboxReportsFromDb(supabase);
    inboxReportsProcessed = reportsResult.processed;
    errors.push(...reportsResult.errors);
  } catch (e) {
    errors.push(`processInboxReportsFromDb: ${String(e)}`);
  }

  // 2. Inbox validation → ai_review_queue
  try {
    const validationResult = await processInboxValidationFromDb(supabase);
    inboxValidationProcessed = validationResult.processed;
    errors.push(...validationResult.errors);
  } catch (e) {
    errors.push(`processInboxValidationFromDb: ${String(e)}`);
  }

  // 3. Inbox événements agent → agent_actions_index / ai_review_queue
  try {
    const agentLogsResult = await processInboxAgentLogsFromDb(supabase);
    inboxAgentLogsExecuted = agentLogsResult.executedIndexed;
    inboxAgentLogsPending = agentLogsResult.pendingEnqueued;
    inboxAgentLogsSkipped = agentLogsResult.skipped;
    errors.push(...agentLogsResult.errors);
  } catch (e) {
    errors.push(`processInboxAgentLogsFromDb: ${String(e)}`);
  }

  // 4. Tâches approuvées en attente d'exécution → exécution puis published_at
  try {
    const approvedResult = await processApprovedTasksFromDb(supabase);
    approvedTasksExecuted = approvedResult.executed;
    errors.push(...approvedResult.errors);
  } catch (e) {
    errors.push(`processApprovedTasksFromDb: ${String(e)}`);
  }

  return {
    inboxReportsProcessed,
    inboxValidationProcessed,
    inboxAgentLogsExecuted,
    inboxAgentLogsPending,
    inboxAgentLogsSkipped,
    approvedTasksExecuted,
    errors,
  };
}
