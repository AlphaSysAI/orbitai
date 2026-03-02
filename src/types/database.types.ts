/**
 * Types pour les tables Supabase (validation_queue, agent_logs).
 * validation_queue : schéma existant (001_openclaw_validation.sql).
 * agent_logs : 003_agent_logs.sql.
 */

export type ValidationQueueStatus = "pending" | "approved" | "rejected";

/** Ligne validation_queue (schéma actuel + executed_at) */
export interface ValidationQueueRow {
  id: string;
  event_id: string;
  user_id: string;
  action: string;
  payload: Record<string, unknown>;
  rationale: string;
  human_input_required: boolean;
  status: ValidationQueueStatus;
  raw_log_line: Record<string, unknown> | null;
  validated_at: string | null;
  validated_by: string | null;
  rejection_reason: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidationQueueInsert {
  id?: string;
  event_id: string;
  user_id: string;
  action: string;
  payload?: Record<string, unknown>;
  rationale?: string;
  human_input_required?: boolean;
  status?: ValidationQueueStatus;
  raw_log_line?: Record<string, unknown> | null;
  validated_at?: string | null;
  validated_by?: string | null;
  rejection_reason?: string | null;
  executed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ValidationQueueUpdate {
  action?: string;
  payload?: Record<string, unknown>;
  rationale?: string;
  human_input_required?: boolean;
  status?: ValidationQueueStatus;
  raw_log_line?: Record<string, unknown> | null;
  validated_at?: string | null;
  validated_by?: string | null;
  rejection_reason?: string | null;
  executed_at?: string | null;
  updated_at?: string;
}

/** Ligne agent_logs */
export interface AgentLogsRow {
  id: string;
  user_id: string;
  action_type: string;
  result: Record<string, unknown>;
  created_at: string;
}

export interface AgentLogsInsert {
  id?: string;
  user_id: string;
  action_type: string;
  result?: Record<string, unknown>;
  created_at?: string;
}

export interface AgentLogsUpdate {
  action_type?: string;
  result?: Record<string, unknown>;
}

/** Table agent_actions_index (mémoire RAG – 001_openclaw_validation.sql) */
export interface AgentActionsIndexRow {
  id: string;
  event_id: string;
  user_id: string;
  action: string;
  status: string;
  payload: Record<string, unknown>;
  rationale: string;
  full_text: string;
  source_file: string | null;
  created_at: string;
}

export interface AgentActionsIndexInsert {
  event_id: string;
  user_id: string;
  action: string;
  status: string;
  payload?: Record<string, unknown>;
  rationale?: string;
  full_text?: string;
  source_file?: string | null;
}

/** Table daily_reports (002_daily_reports.sql) */
export interface DailyReportsRow {
  id: string;
  user_id: string;
  report_date: string;
  summary: string;
  events: unknown[];
  metadata: Record<string, unknown>;
  source_file: string | null;
  created_at: string;
}

export interface DailyReportsInsert {
  user_id: string;
  report_date: string;
  summary?: string;
  events?: unknown[];
  metadata?: Record<string, unknown>;
  source_file?: string | null;
}

/** Table inbox_agent_logs (004 – remplace logs/daily fichiers) */
export interface InboxAgentLogRow {
  id: string;
  event_id: string;
  user_id: string;
  action: string;
  status: string;
  payload: Record<string, unknown>;
  rationale: string;
  human_input_required: boolean;
  raw_line: Record<string, unknown> | null;
  created_at: string;
  processed_at: string | null;
}

export interface InboxAgentLogInsert {
  event_id: string;
  user_id: string;
  action: string;
  status: string;
  payload?: Record<string, unknown>;
  rationale?: string;
  human_input_required?: boolean;
  raw_line?: Record<string, unknown> | null;
}

/** Table inbox_reports (004 – remplace inbox/reports fichiers) */
export interface InboxReportRow {
  id: string;
  user_id: string;
  report_date: string;
  summary: string;
  events: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
  processed_at: string | null;
}

export interface InboxReportInsert {
  user_id: string;
  report_date: string;
  summary?: string;
  events?: unknown[];
  metadata?: Record<string, unknown>;
}

/** Table inbox_validation (004 – remplace inbox/validation fichiers) */
export interface InboxValidationRow {
  id: string;
  event_id: string;
  user_id: string;
  action: string;
  payload: Record<string, unknown>;
  rationale: string;
  human_input_required: boolean;
  created_at: string;
  processed_at: string | null;
}

export interface InboxValidationInsert {
  event_id: string;
  user_id: string;
  action: string;
  payload?: Record<string, unknown>;
  rationale?: string;
  human_input_required?: boolean;
}

/** Table skill_manifests (004 – remplace data/skills/) */
export interface SkillManifestRow {
  id: string;
  version: string;
  action_type: string;
  payload: Record<string, unknown>;
  hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillManifestInsert {
  id: string;
  version?: string;
  action_type: string;
  payload?: Record<string, unknown>;
  hash?: string | null;
}

export interface SkillManifestUpdate {
  version?: string;
  payload?: Record<string, unknown>;
  hash?: string | null;
  updated_at?: string;
}

/** Statuts Auto-Pilot (005_automation_policies_autopilot.sql) */
export type AutomationPolicyStatus = "PENDING" | "DECLINED_50" | "DECLINED_100" | "ENABLED";

/** Table automation_policies (Auto-Pilot, deux paliers de confiance) */
export interface AutomationPolicyRow {
  id: string;
  user_id: string;
  action_type: string;
  status: AutomationPolicyStatus;
  created_at: string;
  updated_at: string;
}

export interface AutomationPolicyInsert {
  id?: string;
  user_id: string;
  action_type: string;
  status?: AutomationPolicyStatus;
  created_at?: string;
  updated_at?: string;
}

export interface AutomationPolicyUpdate {
  status?: AutomationPolicyStatus;
  updated_at?: string;
}

/** Schéma des tables public pour le client Supabase (typage générique) */
export interface Database {
  public: {
    Tables: {
      validation_queue: {
        Row: ValidationQueueRow;
        Insert: ValidationQueueInsert;
        Update: ValidationQueueUpdate;
      };
      agent_logs: {
        Row: AgentLogsRow;
        Insert: AgentLogsInsert;
        Update: AgentLogsUpdate;
      };
      agent_actions_index: {
        Row: AgentActionsIndexRow;
        Insert: AgentActionsIndexInsert;
        Update: Partial<AgentActionsIndexInsert>;
      };
      daily_reports: {
        Row: DailyReportsRow;
        Insert: DailyReportsInsert;
        Update: Partial<DailyReportsInsert>;
      };
      inbox_agent_logs: {
        Row: InboxAgentLogRow;
        Insert: InboxAgentLogInsert;
        Update: { processed_at?: string | null };
      };
      inbox_reports: {
        Row: InboxReportRow;
        Insert: InboxReportInsert;
        Update: { processed_at?: string | null };
      };
      inbox_validation: {
        Row: InboxValidationRow;
        Insert: InboxValidationInsert;
        Update: { processed_at?: string | null };
      };
      skill_manifests: {
        Row: SkillManifestRow;
        Insert: SkillManifestInsert;
        Update: SkillManifestUpdate;
      };
      automation_policies: {
        Row: AutomationPolicyRow;
        Insert: AutomationPolicyInsert;
        Update: AutomationPolicyUpdate;
      };
    };
  };
}
