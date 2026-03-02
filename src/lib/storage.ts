import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentActionsIndexInsert,
  AgentLogsInsert,
  AgentLogsRow,
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
  ValidationQueueUpdate,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

/** Assertion pour satisfaire le typage strict Supabase (Insert/Update inférés en never si schéma manquant). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asInsert<T>(x: T): any {
  return x;
}

/**
 * Enregistre un log agent (table agent_logs).
 * @returns La ligne insérée ou null en cas d'erreur
 */
export async function saveAgentLog(
  supabase: Client,
  data: AgentLogsInsert
): Promise<{ data: AgentLogsRow | null; error: Error | null }> {
  const { data: row, error } = await supabase
    .from("agent_logs")
    .insert(asInsert({
      user_id: data.user_id,
      action_type: data.action_type,
      result: data.result ?? {},
    }))
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: row as AgentLogsRow, error: null };
}

/**
 * Ajoute une entrée dans la file de validation (validation_queue).
 * @returns La ligne insérée ou null en cas d'erreur
 */
export async function addToValidationQueue(
  supabase: Client,
  data: ValidationQueueInsert
): Promise<{ data: ValidationQueueRow | null; error: Error | null }> {
  const { data: row, error } = await supabase
    .from("validation_queue")
    .insert(asInsert({
      event_id: data.event_id,
      user_id: data.user_id,
      action: data.action,
      payload: data.payload ?? {},
      rationale: data.rationale ?? "",
      human_input_required: data.human_input_required ?? true,
      status: data.status ?? "pending",
      raw_log_line: data.raw_log_line ?? null,
    }))
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: row as ValidationQueueRow, error: null };
}

/**
 * Récupère les tâches en attente de validation pour un utilisateur.
 */
export async function fetchPendingValidations(
  supabase: Client,
  userId: string
): Promise<{ data: ValidationQueueRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("validation_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };
  return { data: (data ?? []) as ValidationQueueRow[], error: null };
}

/**
 * Récupère une entrée de la file de validation par id.
 */
export async function getValidationQueueItem(
  supabase: Client,
  id: string
): Promise<{ data: ValidationQueueRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("validation_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { data: null, error };
  return { data: data as ValidationQueueRow, error: null };
}

export type ValidationQueueFetchResult = {
  data: ValidationQueueRow | null;
  error: Error | null;
  /** true lorsque la ligne n'existe pas (ex. PGRST116) */
  notFound?: boolean;
};

/**
 * Récupère une entrée de la file de validation par event_id.
 */
export async function getValidationQueueItemByEventId(
  supabase: Client,
  eventId: string
): Promise<ValidationQueueFetchResult> {
  const { data, error } = await supabase
    .from("validation_queue")
    .select("*")
    .eq("event_id", eventId)
    .single();

  const err = error as { code?: string } | null;
  if (err?.code === "PGRST116") {
    return { data: null, error: null, notFound: true };
  }
  if (error) return { data: null, error };
  return { data: data as ValidationQueueRow, error: null };
}

/**
 * Met à jour le statut d'une entrée dans la file de validation.
 */
export async function updateValidationStatus(
  supabase: Client,
  id: string,
  status: ValidationQueueStatus,
  options?: { validated_by?: string; rejection_reason?: string }
): Promise<{ error: Error | null }> {
  const update: ValidationQueueUpdate = {
    status,
    updated_at: new Date().toISOString(),
    validated_at: new Date().toISOString(),
  };
  if (options?.validated_by) update.validated_by = options.validated_by;
  if (options?.rejection_reason != null) update.rejection_reason = options.rejection_reason;

  const { error } = await supabase.from("validation_queue").update(asInsert(update)).eq("id", id);
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
  const { error } = await supabase.from("agent_actions_index").upsert(
    asInsert({
      event_id: data.event_id,
      user_id: data.user_id,
      action: data.action,
      status: data.status,
      payload: data.payload ?? {},
      rationale: data.rationale ?? "",
      full_text: data.full_text,
    }),
    { onConflict: "event_id" }
  );
  return { error: error ?? null };
}

// --- Database-first inbox & execution (remplace file-based) ---

/**
 * Récupère les tâches approuvées dont l'exécution n'a pas encore été faite (remplace lecture outbox).
 */
export async function fetchApprovedTasksPendingExecution(
  supabase: Client
): Promise<{ data: ValidationQueueRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("validation_queue")
    .select("*")
    .eq("status", "approved")
    .is("executed_at", null)
    .order("validated_at", { ascending: true });

  if (error) return { data: [], error };
  return { data: (data ?? []) as ValidationQueueRow[], error: null };
}

/**
 * Marque une tâche de la file de validation comme exécutée (remplace fichier ack en outbox).
 */
export async function setValidationQueueExecuted(
  supabase: Client,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("validation_queue")
    .update(asInsert({ executed_at: new Date().toISOString(), updated_at: new Date().toISOString() }))
    .eq("id", id);
  return { error: error ?? null };
}

/**
 * Upsert dans validation_queue (conflit sur event_id). Utilisé par le worker lors du drain inbox.
 */
export async function upsertToValidationQueue(
  supabase: Client,
  data: ValidationQueueInsert
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("validation_queue").upsert(
    asInsert({
      event_id: data.event_id,
      user_id: data.user_id,
      action: data.action,
      payload: data.payload ?? {},
      rationale: data.rationale ?? "",
      human_input_required: data.human_input_required ?? true,
      status: data.status ?? "pending",
      raw_log_line: data.raw_log_line ?? null,
    }),
    { onConflict: "event_id" }
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
  const { error } = await supabase
    .from("inbox_agent_logs")
    .update(asInsert({ processed_at: new Date().toISOString() }))
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
  const { error } = await supabase.from("inbox_agent_logs").insert(asInsert({
    event_id: data.event_id,
    user_id: data.user_id,
    action: data.action,
    status: data.status,
    payload: data.payload ?? {},
    rationale: data.rationale ?? "",
    human_input_required: data.human_input_required ?? true,
    raw_line: data.raw_line ?? null,
  }));
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
  const { error } = await supabase
    .from("inbox_reports")
    .update(asInsert({ processed_at: new Date().toISOString() }))
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
  const { error } = await supabase.from("daily_reports").insert(asInsert({
    user_id: data.user_id,
    report_date: data.report_date,
    summary: data.summary ?? "",
    events: data.events ?? [],
    metadata: data.metadata ?? {},
    source_file: data.source_file ?? null,
  }));
  return { error: error ?? null };
}

/**
 * Insère un rapport dans inbox_reports (pour API ou système externe).
 */
export async function insertInboxReport(
  supabase: Client,
  data: InboxReportInsert
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from("inbox_reports").insert(asInsert({
    user_id: data.user_id,
    report_date: data.report_date,
    summary: data.summary ?? "",
    events: data.events ?? [],
    metadata: data.metadata ?? {},
  }));
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
  const { error } = await supabase
    .from("inbox_validation")
    .update(asInsert({ processed_at: new Date().toISOString() }))
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
  const { error } = await supabase.from("inbox_validation").insert(asInsert({
    event_id: data.event_id,
    user_id: data.user_id,
    action: data.action,
    payload: data.payload ?? {},
    rationale: data.rationale ?? "",
    human_input_required: data.human_input_required ?? true,
  }));
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
  const { error } = await supabase.from("skill_manifests").upsert(
    asInsert({
      id: data.id,
      version: data.version ?? "0",
      action_type: data.action_type,
      payload: data.payload ?? {},
      hash: data.hash ?? null,
      updated_at: new Date().toISOString(),
    }),
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
  const { data, error } = await supabase.rpc("get_success_count_by_action", {
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
  const { data: row, error } = await supabase
    .from("automation_policies")
    .upsert(
      asInsert({
        user_id: data.user_id,
        action_type: data.action_type,
        status: data.status ?? "PENDING",
        updated_at: new Date().toISOString(),
      }),
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
  const { error } = await supabase
    .from("automation_policies")
    .update(asInsert({ status, updated_at: new Date().toISOString() }))
    .eq("id", id);
  return { error: error ?? null };
}
