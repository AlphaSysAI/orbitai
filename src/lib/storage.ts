import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getLegacyActionLabel,
  legacyActionToReviewFields,
} from "@/lib/review/types";
import { forWrite } from "@/lib/supabase-write";
import type {
  AgentActionsIndexInsert,
  AgentLogsInsert,
  AgentLogsRow,
  AiReviewQueueInsert,
  AiReviewQueueRow,
  AiReviewQueueUpdate,
  AutomationPolicyInsert,
  AutomationPolicyRow,
  AutomationPolicyStatus,
  AutomationPolicyUpdate,
  Database,
  DailyReportsInsert,
  InboxAgentLogInsert,
  InboxAgentLogRow,
  InboxReportInsert,
  InboxReportRow,
  InboxValidationInsert,
  InboxValidationRow,
  SkillManifestInsert,
  SkillManifestRow,
  SkillManifestUpdate,
  ValidationQueueInsert,
  ValidationQueueRow,
  ValidationQueueStatus,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

/**
 * Enregistre un log agent (table agent_logs).
 * @returns La ligne insérée ou null en cas d'erreur
 */
export async function saveAgentLog(
  supabase: Client,
  data: AgentLogsInsert
): Promise<{ data: AgentLogsRow | null; error: Error | null }> {
  const { data: row, error } = await forWrite(supabase)
    .from("agent_logs")
    .insert({
      user_id: data.user_id,
      action_type: data.action_type,
      result: data.result ?? {},
    })
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: row as AgentLogsRow, error: null };
}

/** @deprecated Shape legacy — mappe une ligne ai_review_queue pour sync-worker / compat. */
export function toLegacyValidationRow(row: AiReviewQueueRow): ValidationQueueRow {
  const humanInputRequired = row.review_metadata?.human_input_required;
  const rawLogLine = row.review_metadata?.raw_log_line;
  return {
    id: row.id,
    event_id: row.review_id,
    user_id: row.user_id,
    action: getLegacyActionLabel(row),
    payload: row.proposed_payload ?? {},
    rationale: row.summary ?? "",
    human_input_required:
      typeof humanInputRequired === "boolean" ? humanInputRequired : true,
    status: row.status,
    raw_log_line:
      rawLogLine != null && typeof rawLogLine === "object"
        ? (rawLogLine as Record<string, unknown>)
        : null,
    validated_at: row.validated_at,
    validated_by: row.validated_by,
    rejection_reason: row.rejection_reason,
    executed_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validationInsertToAiReview(data: ValidationQueueInsert): AiReviewQueueInsert {
  const { review_type, review_metadata, title } = legacyActionToReviewFields(data.action);
  const metadata: Record<string, unknown> = { ...review_metadata };
  if (data.human_input_required !== undefined) {
    metadata.human_input_required = data.human_input_required;
  }
  if (data.raw_log_line != null) {
    metadata.raw_log_line = data.raw_log_line;
  }
  return {
    review_id: data.event_id,
    user_id: data.user_id,
    review_type,
    title,
    summary: data.rationale ?? "",
    proposed_payload: data.payload ?? {},
    source_module: "legacy_openclaw",
    status: data.status ?? "pending",
    review_metadata: metadata,
    published_at: data.executed_at ?? undefined,
  };
}

/**
 * Ajoute une entrée dans ai_review_queue (AI Review Engine).
 * @deprecated Préférer upsertReview depuis @/lib/review/queue.
 */
export async function addToValidationQueue(
  supabase: Client,
  data: ValidationQueueInsert
): Promise<{ data: ValidationQueueRow | null; error: Error | null }> {
  const insert = validationInsertToAiReview(data);
  const { data: row, error } = await forWrite(supabase)
    .from("ai_review_queue")
    .insert(insert)
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: toLegacyValidationRow(row as AiReviewQueueRow), error: null };
}

/**
 * Récupère les tâches en attente de validation pour un utilisateur.
 * @deprecated Préférer fetchPendingReviews depuis @/lib/review/queue.
 */
export async function fetchPendingValidations(
  supabase: Client,
  userId: string
): Promise<{ data: ValidationQueueRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("ai_review_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };
  return {
    data: ((data ?? []) as AiReviewQueueRow[]).map(toLegacyValidationRow),
    error: null,
  };
}

/**
 * Récupère une entrée ai_review_queue par id (shape legacy).
 * @deprecated Préférer getReviewById depuis @/lib/review/queue.
 */
export async function getValidationQueueItem(
  supabase: Client,
  id: string
): Promise<{ data: ValidationQueueRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("ai_review_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { data: null, error };
  return { data: toLegacyValidationRow(data as AiReviewQueueRow), error: null };
}

export type ValidationQueueFetchResult = {
  data: ValidationQueueRow | null;
  error: Error | null;
  /** true lorsque la ligne n'existe pas (ex. PGRST116) */
  notFound?: boolean;
};

/**
 * Récupère une entrée ai_review_queue par review_id (ex-event_id).
 * @deprecated Préférer getReviewByReviewId depuis @/lib/review/queue.
 */
export async function getValidationQueueItemByEventId(
  supabase: Client,
  eventId: string
): Promise<ValidationQueueFetchResult> {
  const { data, error } = await supabase
    .from("ai_review_queue")
    .select("*")
    .eq("review_id", eventId)
    .single();

  const err = error as { code?: string } | null;
  if (err?.code === "PGRST116") {
    return { data: null, error: null, notFound: true };
  }
  if (error) return { data: null, error };
  return { data: toLegacyValidationRow(data as AiReviewQueueRow), error: null };
}

/**
 * Met à jour le statut d'une entrée ai_review_queue.
 * @deprecated Préférer updateReviewStatus depuis @/lib/review/queue.
 */
export async function updateValidationStatus(
  supabase: Client,
  id: string,
  status: ValidationQueueStatus,
  options?: { validated_by?: string; rejection_reason?: string }
): Promise<{ error: Error | null }> {
  const update: AiReviewQueueUpdate = {
    status,
    updated_at: new Date().toISOString(),
    validated_at: new Date().toISOString(),
  };
  if (options?.validated_by) update.validated_by = options.validated_by;
  if (options?.rejection_reason != null) update.rejection_reason = options.rejection_reason;

  const { error } = await forWrite(supabase).from("ai_review_queue").update(update).eq("id", id);
  return { error: error ?? null };
}

/**
 * Insère ou met à jour une entrée dans agent_actions_index (mémoire RAG).
 * Conflit sur event_id : mise à jour de la ligne existante.
 */
export async function upsertAgentActionIndex(
  supabase: Client,
  data: AgentActionsIndexInsert & { full_text: string }
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase).from("agent_actions_index").upsert(
    {
      event_id: data.event_id,
      user_id: data.user_id,
      action: data.action,
      status: data.status,
      payload: data.payload ?? {},
      rationale: data.rationale ?? "",
      full_text: data.full_text,
    },
    { onConflict: "event_id" }
  );
  return { error: error ?? null };
}

// --- Database-first inbox & execution (remplace file-based) ---

/**
 * Récupère les révisions approuvées dont la publication worker n'a pas encore été faite.
 * published_at IS NULL = ex-executed_at IS NULL (sync-worker OpenClaw legacy).
 */
export async function fetchApprovedTasksPendingExecution(
  supabase: Client
): Promise<{ data: ValidationQueueRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("ai_review_queue")
    .select("*")
    .eq("status", "approved")
    .eq("review_type", "legacy_action")
    .is("published_at", null)
    .order("validated_at", { ascending: true });

  if (error) return { data: [], error };
  return {
    data: ((data ?? []) as AiReviewQueueRow[]).map(toLegacyValidationRow),
    error: null,
  };
}

/**
 * Marque une révision approuvée comme publiée/exécutée (ex-setValidationQueueExecuted).
 */
export async function setValidationQueueExecuted(
  supabase: Client,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase)
    .from("ai_review_queue")
    .update(
      { published_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    )
    .eq("id", id);
  return { error: error ?? null };
}

/**
 * Upsert dans ai_review_queue (conflit sur review_id). Utilisé par le worker lors du drain inbox.
 * N'écrit jamais via une VIEW legacy (supprimée migration 008).
 */
export async function upsertToValidationQueue(
  supabase: Client,
  data: ValidationQueueInsert
): Promise<{ error: Error | null }> {
  const insert = validationInsertToAiReview(data);
  const { error } = await forWrite(supabase).from("ai_review_queue").upsert(
    {
      review_id: insert.review_id,
      user_id: insert.user_id,
      review_type: insert.review_type ?? "legacy_action",
      title: insert.title ?? "legacy_action",
      summary: insert.summary ?? "",
      proposed_payload: insert.proposed_payload ?? {},
      source_module: insert.source_module ?? "legacy_openclaw",
      status: insert.status ?? "pending",
      review_metadata: insert.review_metadata ?? {},
      priority: insert.priority ?? 0,
    },
    { onConflict: "review_id" }
  );
  return { error: error ?? null };
}

/**
 * Récupère les événements agent non encore traités (inbox_agent_logs).
 */
export async function fetchUnprocessedInboxAgentLogs(
  supabase: Client,
  limit = 100
): Promise<{ data: InboxAgentLogRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("inbox_agent_logs")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { data: [], error };
  return { data: (data ?? []) as InboxAgentLogRow[], error: null };
}

/**
 * Marque un événement inbox_agent_logs comme traité.
 */
export async function markInboxAgentLogProcessed(
  supabase: Client,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase)
    .from("inbox_agent_logs")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error ?? null };
}

/**
 * Insère un événement dans inbox_agent_logs (pour API ou agent externe).
 */
export async function insertInboxAgentLog(
  supabase: Client,
  data: InboxAgentLogInsert
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase).from("inbox_agent_logs").insert({
    event_id: data.event_id,
    user_id: data.user_id,
    action: data.action,
    status: data.status,
    payload: data.payload ?? {},
    rationale: data.rationale ?? "",
    human_input_required: data.human_input_required ?? true,
    raw_line: data.raw_line ?? null,
  });
  return { error: error ?? null };
}

/**
 * Récupère les rapports inbox non encore traités.
 */
export async function fetchUnprocessedInboxReports(
  supabase: Client,
  limit = 50
): Promise<{ data: InboxReportRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("inbox_reports")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { data: [], error };
  return { data: (data ?? []) as InboxReportRow[], error: null };
}

/**
 * Marque un rapport inbox comme traité.
 */
export async function markInboxReportProcessed(
  supabase: Client,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase)
    .from("inbox_reports")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error ?? null };
}

/**
 * Insère un rapport dans daily_reports (worker après drain inbox_reports).
 */
export async function insertDailyReport(
  supabase: Client,
  data: DailyReportsInsert
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase).from("daily_reports").insert({
    user_id: data.user_id,
    report_date: data.report_date,
    summary: data.summary ?? "",
    events: data.events ?? [],
    metadata: data.metadata ?? {},
    source_file: data.source_file ?? null,
  });
  return { error: error ?? null };
}

/**
 * Insère un rapport dans inbox_reports (pour API ou système externe).
 */
export async function insertInboxReport(
  supabase: Client,
  data: InboxReportInsert
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase).from("inbox_reports").insert({
    user_id: data.user_id,
    report_date: data.report_date,
    summary: data.summary ?? "",
    events: data.events ?? [],
    metadata: data.metadata ?? {},
  });
  return { error: error ?? null };
}

/**
 * Récupère les demandes de validation inbox non encore traitées.
 */
export async function fetchUnprocessedInboxValidation(
  supabase: Client,
  limit = 100
): Promise<{ data: InboxValidationRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("inbox_validation")
    .select("*")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return { data: [], error };
  return { data: (data ?? []) as InboxValidationRow[], error: null };
}

/**
 * Marque une demande inbox_validation comme traitée.
 */
export async function markInboxValidationProcessed(
  supabase: Client,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase)
    .from("inbox_validation")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error ?? null };
}

/**
 * Insère une demande dans inbox_validation (pour API ou système externe).
 */
export async function insertInboxValidation(
  supabase: Client,
  data: InboxValidationInsert
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase).from("inbox_validation").insert({
    event_id: data.event_id,
    user_id: data.user_id,
    action: data.action,
    payload: data.payload ?? {},
    rationale: data.rationale ?? "",
    human_input_required: data.human_input_required ?? true,
  });
  return { error: error ?? null };
}

/**
 * Récupère un skill par action_type depuis la table skill_manifests (remplace lecture data/skills/).
 */
export async function getSkillByActionType(
  supabase: Client,
  actionType: string
): Promise<{ data: SkillManifestRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("skill_manifests")
    .select("*")
    .eq("action_type", actionType)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: data as SkillManifestRow | null, error: null };
}

/**
 * Insère ou met à jour un skill (conflit sur action_type).
 */
export async function upsertSkillManifest(
  supabase: Client,
  data: SkillManifestInsert
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase).from("skill_manifests").upsert(
    {
      id: data.id,
      version: data.version ?? "0",
      action_type: data.action_type,
      payload: data.payload ?? {},
      hash: data.hash ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "action_type" }
  );
  return { error: error ?? null };
}

// --- Auto-Pilot (automation_policies) ---

export type SuccessCountByAction = { action_type: string; success_count: number };

/**
 * Retourne le success_count par action_type pour un utilisateur (RPC get_success_count_by_action).
 */
export async function getSuccessCountByAction(
  supabase: Client,
  userId: string
): Promise<{ data: SuccessCountByAction[]; error: Error | null }> {
  const { data, error } = await forWrite(supabase).rpc("get_success_count_by_action", {
    p_user_id: userId,
  });
  if (error) return { data: [], error };
  const rows = (data ?? []) as { action_type: string; success_count: number }[];
  return { data: rows, error: null };
}

/**
 * Récupère toutes les politiques d'automatisation pour un utilisateur.
 */
export async function fetchAutomationPoliciesForUser(
  supabase: Client,
  userId: string
): Promise<{ data: AutomationPolicyRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("automation_policies")
    .select("*")
    .eq("user_id", userId)
    .order("action_type", { ascending: true });

  if (error) return { data: [], error };
  return { data: (data ?? []) as AutomationPolicyRow[], error: null };
}

/**
 * Récupère la politique pour (user_id, action_type) — pour le worker.
 */
export async function getAutomationPolicy(
  supabase: Client,
  userId: string,
  actionType: string
): Promise<{ data: AutomationPolicyRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("automation_policies")
    .select("*")
    .eq("user_id", userId)
    .eq("action_type", actionType)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: data as AutomationPolicyRow | null, error: null };
}

/**
 * Récupère les politiques ENABLED pour un utilisateur (paramètres / révocation).
 */
export async function fetchEnabledAutomationPolicies(
  supabase: Client,
  userId: string
): Promise<{ data: AutomationPolicyRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("automation_policies")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "ENABLED")
    .order("action_type", { ascending: true });

  if (error) return { data: [], error };
  return { data: (data ?? []) as AutomationPolicyRow[], error: null };
}

/**
 * Insère ou met à jour une politique (conflit sur user_id, action_type). Création en PENDING si besoin.
 */
export async function upsertAutomationPolicy(
  supabase: Client,
  data: AutomationPolicyInsert
): Promise<{ data: AutomationPolicyRow | null; error: Error | null }> {
  const { data: row, error } = await forWrite(supabase)
    .from("automation_policies")
    .upsert(
      {
        user_id: data.user_id,
        action_type: data.action_type,
        status: data.status ?? "PENDING",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,action_type" }
    )
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: row as AutomationPolicyRow, error: null };
}

/**
 * Met à jour le statut d'une politique (palier 1/2 accepté ou refusé, ou révocation).
 */
export async function updateAutomationPolicyStatus(
  supabase: Client,
  id: string,
  status: AutomationPolicyStatus
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase)
    .from("automation_policies")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error ?? null };
}
