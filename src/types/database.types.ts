/**
 * Types pour les tables Supabase (ai_review_queue, agent_logs).
 * ai_review_queue : migration 007_ai_review_engine.sql.
 * agent_logs : 003_agent_logs.sql.
 */

/** Type JSON Supabase (colonnes jsonb). */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ReviewStatus = "pending" | "approved" | "rejected";

/** @deprecated Utiliser ReviewStatus */
export type ValidationQueueStatus = ReviewStatus;

export type ReviewType =
  | "knowledge_concept"
  | "knowledge_procedure"
  | "knowledge_role"
  | "knowledge_faq"
  | "document_summary"
  | "learning_path"
  | "quiz"
  | "expert_pattern"
  | "automation_suggestion"
  | "legacy_action";

/** Ligne ai_review_queue (AI Review Engine) */
export interface AiReviewQueueRow {
  id: string;
  review_id: string;
  user_id: string;
  review_type: ReviewType | string;
  subject_type: string | null;
  subject_id: string | null;
  source_module: string | null;
  title: string;
  summary: string;
  proposed_payload: Record<string, unknown>;
  source_context: Record<string, unknown>;
  status: ReviewStatus;
  validated_at: string | null;
  validated_by: string | null;
  rejection_reason: string | null;
  published_at: string | null;
  priority: number;
  review_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AiReviewQueueInsert {
  id?: string;
  review_id: string;
  user_id: string;
  review_type?: ReviewType | string;
  subject_type?: string | null;
  subject_id?: string | null;
  source_module?: string | null;
  title?: string;
  summary?: string;
  proposed_payload?: Record<string, unknown>;
  source_context?: Record<string, unknown>;
  status?: ReviewStatus;
  validated_at?: string | null;
  validated_by?: string | null;
  rejection_reason?: string | null;
  published_at?: string | null;
  priority?: number;
  review_metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface AiReviewQueueUpdate {
  review_type?: ReviewType | string;
  subject_type?: string | null;
  subject_id?: string | null;
  source_module?: string | null;
  title?: string;
  summary?: string;
  proposed_payload?: Record<string, unknown>;
  source_context?: Record<string, unknown>;
  status?: ReviewStatus;
  validated_at?: string | null;
  validated_by?: string | null;
  rejection_reason?: string | null;
  published_at?: string | null;
  priority?: number;
  review_metadata?: Record<string, unknown>;
  updated_at?: string;
}

/**
 * @deprecated Utiliser AiReviewQueueRow — shape legacy pour sync-worker / compat.
 */
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

/** @deprecated Utiliser AiReviewQueueInsert */
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

/** @deprecated Utiliser AiReviewQueueUpdate */
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

/** Table organizations (009 multi-tenant) */
export interface OrganizationRow {
  id: string;
  name: string;
  manager_first_name: string | null;
  manager_last_name: string | null;
  manager_email: string | null;
  business_sector: string | null;
  created_at: string;
}

export interface OrganizationMemberRow {
  id: string;
  organization_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | string;
  created_at: string;
}

export interface OrganizationModuleRow {
  id: string;
  organization_id: string;
  module_name: string;
  is_enabled: boolean;
  updated_at: string;
}

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

/** RégiAire — statut livraison (013) */
export type DeliveryStatus = "draft" | "scanning" | "discrepancy" | "completed";

export interface SupplierRow {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  created_at: string;
}

export interface ProductRow {
  id: string;
  organization_id: string;
  ean: string;
  name: string;
  has_dlc: boolean;
  category: string | null;
  created_at: string;
}

export interface DeliveryRow {
  id: string;
  organization_id: string;
  supplier_id: string;
  status: DeliveryStatus;
  bl_file_path: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface DeliveryLineRow {
  id: string;
  delivery_id: string;
  product_id: string | null;
  raw_name: string;
  ean: string | null;
  expected_qty: number;
  scanned_qty: number;
  dlc: string | null;
  needs_review: boolean;
}

export interface StockBatchRow {
  id: string;
  organization_id: string;
  product_id: string;
  quantity: number;
  dlc: string | null;
  delivery_id: string;
  entered_at: string;
}

export type ShiftPeriod = "matin" | "apres_midi" | "nuit";

export interface ShiftTaskDefRow {
  id: string;
  organization_id: string;
  label: string;
  shifts: ShiftPeriod[];
  position: number;
  active: boolean;
  created_at: string;
}

export interface ShiftTaskCheckRow {
  id: string;
  organization_id: string;
  shift: ShiftPeriod;
  service_date: string;
  task_def_id: string;
  checked: boolean;
  checked_by: string | null;
  checked_at: string | null;
}

export interface ShiftClosureRow {
  id: string;
  organization_id: string;
  shift: ShiftPeriod;
  service_date: string;
  closed_by: string;
  closed_at: string;
  total_tasks: number;
  checked_tasks: number;
  completion_pct: number;
  missing_labels: string[];
  note: string | null;
}

export interface RegiaireStationSettingsRow {
  id: string;
  organization_id: string;
  lat: number;
  lon: number;
  city: string | null;
  school_zone: string;
  order_days: number[];
  updated_at: string;
}

export interface SalesHistoryRow {
  id: string;
  organization_id: string;
  product_id: string;
  sale_date: string;
  quantity: number;
}

export interface TrafficSignalRow {
  id: string;
  organization_id: string;
  signal_date: string;
  footfall_index: number;
}

export interface VerdictRunRow {
  id: string;
  organization_id: string;
  run_date: string;
  signals: Json;
  recommendation: Json;
  created_by: string;
  created_at: string;
}

/** Schéma des tables public pour le client Supabase (typage générique) */
type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      ai_review_queue: TableDef<AiReviewQueueRow, AiReviewQueueInsert, AiReviewQueueUpdate>;
      agent_logs: TableDef<AgentLogsRow, AgentLogsInsert, AgentLogsUpdate>;
      agent_actions_index: TableDef<
        AgentActionsIndexRow,
        AgentActionsIndexInsert,
        Partial<AgentActionsIndexInsert>
      >;
      daily_reports: TableDef<DailyReportsRow, DailyReportsInsert, Partial<DailyReportsInsert>>;
      inbox_agent_logs: TableDef<
        InboxAgentLogRow,
        InboxAgentLogInsert,
        { processed_at?: string | null }
      >;
      inbox_reports: TableDef<
        InboxReportRow,
        InboxReportInsert,
        { processed_at?: string | null }
      >;
      inbox_validation: TableDef<
        InboxValidationRow,
        InboxValidationInsert,
        { processed_at?: string | null }
      >;
      skill_manifests: TableDef<SkillManifestRow, SkillManifestInsert, SkillManifestUpdate>;
      automation_policies: TableDef<
        AutomationPolicyRow,
        AutomationPolicyInsert,
        AutomationPolicyUpdate
      >;
      organizations: TableDef<
        OrganizationRow,
        Pick<OrganizationRow, "name"> & {
          id?: string;
          manager_first_name?: string | null;
          manager_last_name?: string | null;
          manager_email?: string | null;
          business_sector?: string | null;
          created_at?: string;
        },
        Partial<
          Pick<
            OrganizationRow,
            "name" | "manager_first_name" | "manager_last_name" | "manager_email" | "business_sector"
          >
        >
      >;
      organization_members: TableDef<
        OrganizationMemberRow,
        Pick<OrganizationMemberRow, "organization_id" | "user_id"> & {
          id?: string;
          role?: string;
          created_at?: string;
        },
        Partial<Pick<OrganizationMemberRow, "role">>
      >;
      organization_modules: TableDef<
        OrganizationModuleRow,
        Pick<OrganizationModuleRow, "organization_id" | "module_name"> & {
          id?: string;
          is_enabled?: boolean;
          updated_at?: string;
        },
        Partial<Pick<OrganizationModuleRow, "is_enabled" | "updated_at">>
      >;
      suppliers: TableDef<
        SupplierRow,
        Pick<SupplierRow, "organization_id" | "name"> & {
          id?: string;
          email?: string | null;
          created_at?: string;
        },
        Partial<Pick<SupplierRow, "name" | "email">>
      >;
      products: TableDef<
        ProductRow,
        Pick<ProductRow, "organization_id" | "ean" | "name"> & {
          id?: string;
          has_dlc?: boolean;
          created_at?: string;
        },
        Partial<Pick<ProductRow, "name" | "has_dlc" | "category">>
      >;
      deliveries: TableDef<
        DeliveryRow,
        Pick<DeliveryRow, "organization_id" | "supplier_id" | "created_by"> & {
          id?: string;
          status?: DeliveryStatus;
          bl_file_path?: string | null;
          created_at?: string;
          completed_at?: string | null;
        },
        Partial<
          Pick<DeliveryRow, "status" | "bl_file_path" | "completed_at">
        >
      >;
      delivery_lines: TableDef<
        DeliveryLineRow,
        Pick<
          DeliveryLineRow,
          "delivery_id" | "raw_name" | "expected_qty"
        > & {
          id?: string;
          product_id?: string | null;
          ean?: string | null;
          scanned_qty?: number;
          dlc?: string | null;
          needs_review?: boolean;
        },
        Partial<
          Pick<
            DeliveryLineRow,
            "product_id" | "scanned_qty" | "dlc" | "ean" | "needs_review"
          >
        >
      >;
      stock_batches: TableDef<
        StockBatchRow,
        Pick<
          StockBatchRow,
          "organization_id" | "product_id" | "quantity" | "delivery_id"
        > & {
          id?: string;
          dlc?: string | null;
          entered_at?: string;
        },
        Partial<Pick<StockBatchRow, "quantity" | "dlc">>
      >;
      shift_task_defs: TableDef<
        ShiftTaskDefRow,
        Pick<ShiftTaskDefRow, "organization_id" | "label" | "shifts"> & {
          id?: string;
          position?: number;
          active?: boolean;
          created_at?: string;
        },
        Partial<Pick<ShiftTaskDefRow, "label" | "shifts" | "position" | "active">>
      >;
      shift_task_checks: TableDef<
        ShiftTaskCheckRow,
        Pick<
          ShiftTaskCheckRow,
          "organization_id" | "shift" | "service_date" | "task_def_id"
        > & {
          id?: string;
          checked?: boolean;
          checked_by?: string | null;
          checked_at?: string | null;
        },
        Partial<
          Pick<ShiftTaskCheckRow, "checked" | "checked_by" | "checked_at">
        >
      >;
      shift_closures: TableDef<
        ShiftClosureRow,
        Pick<
          ShiftClosureRow,
          | "organization_id"
          | "shift"
          | "service_date"
          | "closed_by"
          | "total_tasks"
          | "checked_tasks"
          | "completion_pct"
        > & {
          id?: string;
          closed_at?: string;
          missing_labels?: string[];
          note?: string | null;
        },
        Partial<Pick<ShiftClosureRow, "note">>
      >;
      regiaire_station_settings: TableDef<
        RegiaireStationSettingsRow,
        Pick<
          RegiaireStationSettingsRow,
          "organization_id" | "lat" | "lon" | "school_zone"
        > & {
          id?: string;
          city?: string | null;
          order_days?: number[];
          updated_at?: string;
        },
        Partial<
          Pick<
            RegiaireStationSettingsRow,
            "lat" | "lon" | "city" | "school_zone" | "order_days" | "updated_at"
          >
        >
      >;
      sales_history: TableDef<
        SalesHistoryRow,
        Pick<
          SalesHistoryRow,
          "organization_id" | "product_id" | "sale_date" | "quantity"
        > & { id?: string },
        Partial<Pick<SalesHistoryRow, "quantity">>
      >;
      traffic_signals: TableDef<
        TrafficSignalRow,
        Pick<
          TrafficSignalRow,
          "organization_id" | "signal_date" | "footfall_index"
        > & { id?: string },
        Partial<Pick<TrafficSignalRow, "footfall_index">>
      >;
      verdict_runs: TableDef<
        VerdictRunRow,
        Pick<
          VerdictRunRow,
          "organization_id" | "run_date" | "created_by"
        > & {
          id?: string;
          signals?: Json;
          recommendation?: Json;
          created_at?: string;
        },
        Partial<Pick<VerdictRunRow, "signals" | "recommendation">>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      get_success_count_by_action: {
        Args: { p_user_id: string };
        Returns: { action_type: string; success_count: number }[];
      };
      org_has_module: {
        Args: { p_organization_id: string; p_module_name: string };
        Returns: boolean;
      };
      get_my_enabled_modules: {
        Args: Record<string, never>;
        Returns: { organization_id: string; module_name: string }[];
      };
      is_org_member: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      regiaire_increment_scan: {
        Args: {
          p_line_id: string;
          p_allow_extra: boolean;
          p_dlc: string | null;
        };
        Returns: DeliveryLineRow[];
      };
      regiaire_decrement_scan: {
        Args: { p_line_id: string };
        Returns: DeliveryLineRow[];
      };
      regiaire_finalize_delivery: {
        Args: { p_delivery_id: string };
        Returns: { outcome: string; batches_created: number }[];
      };
    };
    Enums: {
      shift_period: ShiftPeriod;
    };
    CompositeTypes: Record<string, never>;
  };
}
