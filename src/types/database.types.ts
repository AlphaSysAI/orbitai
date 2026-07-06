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

/** Orbit Aire — statut livraison (013) */
export type DeliveryStatus = "draft" | "scanning" | "discrepancy" | "completed";

export interface SupplierRow {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  lead_time_days: number;
  created_at: string;
}

export interface ProductRow {
  id: string;
  organization_id: string;
  ean: string;
  name: string;
  has_dlc: boolean;
  category: string | null;
  supplier_id: string | null;
  created_at: string;
}

export interface DeliveryRow {
  id: string;
  organization_id: string;
  aire_id: string;
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
  aire_id: string;
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
  aire_id: string;
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
  aire_id: string;
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

export interface AireRow {
  id: string;
  organization_id: string;
  name: string;
  lat: number;
  lon: number;
  city: string | null;
  address: string | null;
  school_zone: string;
  order_days: number[];
  bison_fute_zone: number | null;
  secteur_id: string | null;
  created_at: string;
}

/** Hiérarchie d'enseigne (029_org_hierarchy.sql) */
export interface SecteurRow {
  id: string;
  organization_id: string;
  name: string;
  chef_user_id: string | null;
  created_at: string;
}

export interface OrgHierarchyLinkRow {
  organization_id: string;
  manager_user_id: string;
  subordinate_user_id: string;
  created_at: string;
}

export interface OrgMemberProfileRow {
  user_id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecteurVerdictRunRow {
  id: string;
  organization_id: string;
  secteur_id: string;
  run_date: string;
  signals: Json;
  recommendation: Json;
  created_by: string;
  created_at: string;
}

export interface GerantAireRow {
  gerant_user_id: string;
  aire_id: string;
  organization_id: string;
  created_at: string;
}

export interface SecteurOverviewCacheRow {
  secteur_id: string;
  organization_id: string;
  run_date: string;
  aire_count: number;
  total_savings_eur: number;
  expiring_count: number;
  in_progress_count: number;
  reception_hours_saved: number;
  computed_at: string;
}

// ─── Orbit Artisan (035) ─────────────────────────────────────────────────────
export interface ArtisanProfileRow {
  organization_id: string;
  business_name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  accent_color: string | null;
  labor_rate_per_hour: number | null;
  created_at: string;
  updated_at: string;
}

export interface ArtisanServiceRow {
  id: string;
  organization_id: string;
  title: string;
  duration: number;
  price: number | null;
  created_at: string;
  updated_at: string;
}

export interface ArtisanContactRow {
  id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ArtisanQuoteStatus = "draft" | "sent" | "accepted" | "rejected";

export interface ArtisanQuoteRow {
  id: string;
  organization_id: string;
  contact_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: ArtisanQuoteStatus;
  labor_rate_per_hour: number | null;
  labor_duration_minutes: number;
  labor_total: number;
  materials_total: number;
  grand_total: number;
  notes: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtisanQuoteServiceRow {
  id: string;
  quote_id: string;
  service_id: string | null;
  service_title: string;
  duration_minutes: number;
  unit_price: number | null;
  line_total: number | null;
  created_at: string;
}

export interface ArtisanQuoteMaterialRow {
  id: string;
  quote_id: string;
  label: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface ArtisanInvoiceRow {
  id: string;
  organization_id: string;
  quote_id: string | null;
  contact_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  invoice_number: string | null;
  status: "draft" | "sent" | "paid";
  labor_total: number;
  materials_total: number;
  grand_total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArtisanInvoiceLineRow {
  id: string;
  invoice_id: string;
  line_kind: "labor" | "service" | "material";
  label: string;
  quantity: number | null;
  unit_price: number | null;
  line_total: number;
  sort_order: number;
  created_at: string;
}

export interface AireModuleRow {
  aire_id: string;
  organization_id: string;
  module_name: string;
  created_at: string;
}

// ─── Orbit Hôtel (037) ───────────────────────────────────────────────────────
export type HotelHousekeepingStatus = "clean" | "dirty" | "inspected" | "out_of_order";

export interface HotelRoomTypeRow {
  id: string;
  organization_id: string;
  code: string;
  nom: string;
  description: string | null;
  capacity_adults: number;
  capacity_children: number;
  base_occupancy: number;
  equipements: Json;
  default_rate_cents: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HotelRoomRow {
  id: string;
  organization_id: string;
  room_type_id: string;
  numero: string;
  etage: string | null;
  attributs: Json;
  housekeeping_status: HotelHousekeepingStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HotelInventoryRow {
  id: string;
  organization_id: string;
  room_type_id: string;
  date: string;
  total: number;
  sold: number;
  created_at: string;
  updated_at: string;
}

export type HotelBoard = "RO" | "BB" | "HB" | "FB";

export interface HotelRatePlanRow {
  id: string;
  organization_id: string;
  code: string;
  nom: string;
  room_type_id: string | null;
  board: HotelBoard;
  refundable: boolean;
  cancellation_policy: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HotelRateCalendarRow {
  id: string;
  organization_id: string;
  rate_plan_id: string;
  room_type_id: string;
  date: string;
  price_cents: number;
  min_stay: number;
  max_stay: number | null;
  closed: boolean;
  cta: boolean;
  ctd: boolean;
  created_at: string;
  updated_at: string;
}

export type HotelReservationStatus =
  | "option"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "no_show"
  | "cancelled";

export type HotelRoomSource = "direct" | "phone" | "walk_in" | "ota_other";

export interface HotelReservationRow {
  id: string;
  organization_id: string;
  reference: string;
  contact_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  source: HotelRoomSource;
  status: HotelReservationStatus;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  total_cents: number;
  paid_cents: number;
  balance_cents: number;
  deposit_cents: number;
  notes: string | null;
  idempotency_key: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface HotelReservationRoomRow {
  id: string;
  organization_id: string;
  reservation_id: string;
  room_type_id: string;
  room_id: string | null;
  rate_plan_id: string;
  check_in: string;
  check_out: string;
  guest_name: string | null;
  occupants: number;
  status: HotelReservationStatus;
  created_at: string;
  updated_at: string;
}

export interface HotelReservationNightRow {
  id: string;
  organization_id: string;
  reservation_room_id: string;
  date: string;
  price_snapshot_cents: number;
  created_at: string;
}

export interface HotelFolioRow {
  id: string;
  organization_id: string;
  reservation_id: string;
  status: "open" | "closed";
  total_cents: number;
  created_at: string;
  updated_at: string;
}

export type HotelPaymentMethod = "cash" | "card" | "transfer" | "other";
export type HotelPaymentKind = "deposit" | "balance" | "refund";

export interface HotelPaymentRow {
  id: string;
  organization_id: string;
  reservation_id: string;
  folio_id: string | null;
  method: HotelPaymentMethod;
  kind: HotelPaymentKind;
  amount_cents: number;
  note: string | null;
  created_at: string;
}

export interface HotelCityTaxConfigRow {
  organization_id: string;
  enabled: boolean;
  amount_cents_per_person_night: number;
  exempt_children: boolean;
  max_nights: number | null;
  updated_at: string;
}

export interface HotelInvoiceRow {
  id: string;
  organization_id: string;
  reservation_id: string | null;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  subtotal_cents: number;
  city_tax_cents: number;
  total_cents: number;
  status: "draft" | "sent" | "paid";
  created_at: string;
  updated_at: string;
}

export interface HotelInvoiceLineRow {
  id: string;
  invoice_id: string;
  label: string;
  amount_cents: number;
  sort_order: number;
  created_at: string;
}

// ─── Orbit Voice (044) ───────────────────────────────────────────────────────
export interface VoiceNumberRow {
  phone_e164: string;
  organization_id: string;
  vertical: "hotel" | "artisan";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VoiceCallLogRow {
  id: string;
  organization_id: string;
  vertical: string;
  caller_number: string | null;
  intent: string | null;
  transcript: string | null;
  reservation_id: string | null;
  created_at: string;
}

export interface AireTeamMemberRow {
  user_id: string;
  aire_id: string;
  organization_id: string;
  created_by: string | null;
  created_at: string;
}

export interface BisonFuteForecastRow {
  id: string;
  forecast_date: string;
  zone: number;
  direction: string;
  level: string;
}

export interface SalesHistoryRow {
  id: string;
  organization_id: string;
  aire_id: string;
  product_id: string;
  sale_date: string;
  quantity: number;
}

export interface TrafficSignalRow {
  id: string;
  organization_id: string;
  aire_id: string;
  signal_date: string;
  footfall_index: number;
}

export interface VerdictRunRow {
  id: string;
  organization_id: string;
  aire_id: string;
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
          lead_time_days?: number;
          created_at?: string;
        },
        Partial<Pick<SupplierRow, "name" | "email" | "lead_time_days">>
      >;
      products: TableDef<
        ProductRow,
        Pick<ProductRow, "organization_id" | "ean" | "name"> & {
          id?: string;
          has_dlc?: boolean;
          supplier_id?: string | null;
          created_at?: string;
        },
        Partial<
          Pick<ProductRow, "name" | "has_dlc" | "category" | "supplier_id">
        >
      >;
      deliveries: TableDef<
        DeliveryRow,
        Pick<DeliveryRow, "organization_id" | "supplier_id" | "created_by"> & {
          id?: string;
          aire_id?: string;
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
          "organization_id" | "aire_id" | "product_id" | "quantity" | "delivery_id"
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
          "organization_id" | "aire_id" | "shift" | "service_date" | "task_def_id"
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
          | "aire_id"
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
      aires: TableDef<
        AireRow,
        Pick<
          AireRow,
          "organization_id" | "name" | "lat" | "lon" | "school_zone"
        > & {
          id?: string;
          city?: string | null;
          address?: string | null;
          order_days?: number[];
          bison_fute_zone?: number | null;
          secteur_id?: string | null;
          created_at?: string;
        },
        Partial<
          Pick<
            AireRow,
            | "name"
            | "lat"
            | "lon"
            | "city"
            | "address"
            | "school_zone"
            | "order_days"
            | "bison_fute_zone"
            | "secteur_id"
          >
        >
      >;
      bison_fute_forecast: TableDef<
        BisonFuteForecastRow,
        Pick<
          BisonFuteForecastRow,
          "forecast_date" | "zone" | "direction" | "level"
        > & { id?: string },
        Partial<Pick<BisonFuteForecastRow, "level">>
      >;
      sales_history: TableDef<
        SalesHistoryRow,
        Pick<
          SalesHistoryRow,
          "organization_id" | "aire_id" | "product_id" | "sale_date" | "quantity"
        > & { id?: string },
        Partial<Pick<SalesHistoryRow, "quantity">>
      >;
      traffic_signals: TableDef<
        TrafficSignalRow,
        Pick<
          TrafficSignalRow,
          "organization_id" | "aire_id" | "signal_date" | "footfall_index"
        > & { id?: string },
        Partial<Pick<TrafficSignalRow, "footfall_index">>
      >;
      verdict_runs: TableDef<
        VerdictRunRow,
        Pick<
          VerdictRunRow,
          "organization_id" | "aire_id" | "run_date" | "created_by"
        > & {
          id?: string;
          signals?: Json;
          recommendation?: Json;
          created_at?: string;
        },
        Partial<Pick<VerdictRunRow, "signals" | "recommendation">>
      >;
      secteurs: TableDef<
        SecteurRow,
        Pick<SecteurRow, "organization_id" | "name"> & {
          id?: string;
          chef_user_id?: string | null;
          created_at?: string;
        },
        Partial<Pick<SecteurRow, "name" | "chef_user_id">>
      >;
      org_hierarchy_links: TableDef<
        OrgHierarchyLinkRow,
        Pick<
          OrgHierarchyLinkRow,
          "organization_id" | "manager_user_id" | "subordinate_user_id"
        > & { created_at?: string },
        Partial<Pick<OrgHierarchyLinkRow, "manager_user_id" | "subordinate_user_id">>
      >;
      org_member_profiles: TableDef<
        OrgMemberProfileRow,
        Pick<
          OrgMemberProfileRow,
          "user_id" | "organization_id" | "first_name" | "last_name" | "email"
        > & {
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        Partial<
          Pick<
            OrgMemberProfileRow,
            "first_name" | "last_name" | "email" | "phone" | "updated_at"
          >
        >
      >;
      secteur_verdict_runs: TableDef<
        SecteurVerdictRunRow,
        Pick<
          SecteurVerdictRunRow,
          "organization_id" | "secteur_id" | "run_date" | "created_by"
        > & {
          id?: string;
          signals?: Json;
          recommendation?: Json;
          created_at?: string;
        },
        Partial<Pick<SecteurVerdictRunRow, "signals" | "recommendation">>
      >;
      gerant_aires: TableDef<
        GerantAireRow,
        Pick<GerantAireRow, "gerant_user_id" | "aire_id" | "organization_id"> & {
          created_at?: string;
        },
        Partial<Pick<GerantAireRow, "aire_id">>
      >;
      secteur_overview_cache: TableDef<
        SecteurOverviewCacheRow,
        Pick<
          SecteurOverviewCacheRow,
          "secteur_id" | "organization_id" | "run_date"
        > & {
          aire_count?: number;
          total_savings_eur?: number;
          expiring_count?: number;
          in_progress_count?: number;
          reception_hours_saved?: number;
          computed_at?: string;
        },
        Partial<
          Pick<
            SecteurOverviewCacheRow,
            | "aire_count"
            | "total_savings_eur"
            | "expiring_count"
            | "in_progress_count"
            | "reception_hours_saved"
            | "computed_at"
          >
        >
      >;
      artisan_profiles: TableDef<
        ArtisanProfileRow,
        Pick<ArtisanProfileRow, "organization_id" | "business_name"> &
          Partial<Omit<ArtisanProfileRow, "organization_id" | "business_name">>,
        Partial<Omit<ArtisanProfileRow, "organization_id">>
      >;
      artisan_services: TableDef<
        ArtisanServiceRow,
        Pick<ArtisanServiceRow, "organization_id" | "title" | "duration"> &
          Partial<Pick<ArtisanServiceRow, "id" | "price" | "created_at" | "updated_at">>,
        Partial<Omit<ArtisanServiceRow, "id" | "organization_id">>
      >;
      artisan_contacts: TableDef<
        ArtisanContactRow,
        Pick<ArtisanContactRow, "organization_id" | "full_name"> &
          Partial<Omit<ArtisanContactRow, "organization_id" | "full_name">>,
        Partial<Omit<ArtisanContactRow, "id" | "organization_id">>
      >;
      artisan_quotes: TableDef<
        ArtisanQuoteRow,
        Pick<ArtisanQuoteRow, "organization_id"> &
          Partial<Omit<ArtisanQuoteRow, "organization_id">>,
        Partial<Omit<ArtisanQuoteRow, "id" | "organization_id">>
      >;
      artisan_quote_services: TableDef<
        ArtisanQuoteServiceRow,
        Pick<
          ArtisanQuoteServiceRow,
          "quote_id" | "service_title" | "duration_minutes"
        > &
          Partial<
            Pick<ArtisanQuoteServiceRow, "id" | "service_id" | "unit_price" | "line_total" | "created_at">
          >,
        Partial<Omit<ArtisanQuoteServiceRow, "id" | "quote_id">>
      >;
      artisan_quote_materials: TableDef<
        ArtisanQuoteMaterialRow,
        Pick<
          ArtisanQuoteMaterialRow,
          "quote_id" | "label" | "unit_price" | "line_total"
        > &
          Partial<Pick<ArtisanQuoteMaterialRow, "id" | "quantity" | "created_at">>,
        Partial<Omit<ArtisanQuoteMaterialRow, "id" | "quote_id">>
      >;
      artisan_invoices: TableDef<
        ArtisanInvoiceRow,
        Pick<ArtisanInvoiceRow, "organization_id"> &
          Partial<Omit<ArtisanInvoiceRow, "organization_id">>,
        Partial<Omit<ArtisanInvoiceRow, "id" | "organization_id">>
      >;
      artisan_invoice_lines: TableDef<
        ArtisanInvoiceLineRow,
        Pick<ArtisanInvoiceLineRow, "invoice_id" | "line_kind" | "label" | "line_total"> &
          Partial<
            Pick<ArtisanInvoiceLineRow, "id" | "quantity" | "unit_price" | "sort_order" | "created_at">
          >,
        Partial<Omit<ArtisanInvoiceLineRow, "id" | "invoice_id">>
      >;
      aire_modules: TableDef<
        AireModuleRow,
        Pick<AireModuleRow, "aire_id" | "organization_id" | "module_name"> & {
          created_at?: string;
        },
        Partial<Pick<AireModuleRow, "module_name">>
      >;
      hotel_room_types: TableDef<
        HotelRoomTypeRow,
        Pick<HotelRoomTypeRow, "organization_id" | "code" | "nom"> &
          Partial<Omit<HotelRoomTypeRow, "organization_id" | "code" | "nom">>,
        Partial<Omit<HotelRoomTypeRow, "id" | "organization_id">>
      >;
      hotel_rooms: TableDef<
        HotelRoomRow,
        Pick<HotelRoomRow, "organization_id" | "room_type_id" | "numero"> &
          Partial<Omit<HotelRoomRow, "organization_id" | "room_type_id" | "numero">>,
        Partial<Omit<HotelRoomRow, "id" | "organization_id">>
      >;
      hotel_inventory_calendar: TableDef<
        HotelInventoryRow,
        Pick<HotelInventoryRow, "organization_id" | "room_type_id" | "date"> &
          Partial<Omit<HotelInventoryRow, "organization_id" | "room_type_id" | "date">>,
        Partial<Omit<HotelInventoryRow, "id" | "organization_id">>
      >;
      hotel_rate_plans: TableDef<
        HotelRatePlanRow,
        Pick<HotelRatePlanRow, "organization_id" | "code" | "nom"> &
          Partial<Omit<HotelRatePlanRow, "organization_id" | "code" | "nom">>,
        Partial<Omit<HotelRatePlanRow, "id" | "organization_id">>
      >;
      hotel_rate_calendar: TableDef<
        HotelRateCalendarRow,
        Pick<HotelRateCalendarRow, "organization_id" | "rate_plan_id" | "room_type_id" | "date" | "price_cents"> &
          Partial<Omit<HotelRateCalendarRow, "organization_id" | "rate_plan_id" | "room_type_id" | "date" | "price_cents">>,
        Partial<Omit<HotelRateCalendarRow, "id" | "organization_id">>
      >;
      hotel_reservations: TableDef<
        HotelReservationRow,
        Pick<HotelReservationRow, "organization_id" | "reference" | "check_in" | "check_out"> &
          Partial<Omit<HotelReservationRow, "organization_id" | "reference" | "check_in" | "check_out">>,
        Partial<Omit<HotelReservationRow, "id" | "organization_id">>
      >;
      hotel_reservation_rooms: TableDef<
        HotelReservationRoomRow,
        Pick<
          HotelReservationRoomRow,
          "organization_id" | "reservation_id" | "room_type_id" | "rate_plan_id" | "check_in" | "check_out"
        > &
          Partial<Omit<HotelReservationRoomRow, "organization_id" | "reservation_id" | "room_type_id" | "rate_plan_id" | "check_in" | "check_out">>,
        Partial<Omit<HotelReservationRoomRow, "id" | "organization_id">>
      >;
      hotel_reservation_nights: TableDef<
        HotelReservationNightRow,
        Pick<HotelReservationNightRow, "organization_id" | "reservation_room_id" | "date" | "price_snapshot_cents"> &
          Partial<Pick<HotelReservationNightRow, "id" | "created_at">>,
        Partial<Pick<HotelReservationNightRow, "price_snapshot_cents">>
      >;
      hotel_folios: TableDef<
        HotelFolioRow,
        Pick<HotelFolioRow, "organization_id" | "reservation_id"> &
          Partial<Omit<HotelFolioRow, "organization_id" | "reservation_id">>,
        Partial<Omit<HotelFolioRow, "id" | "organization_id">>
      >;
      hotel_payments: TableDef<
        HotelPaymentRow,
        Pick<HotelPaymentRow, "organization_id" | "reservation_id" | "method" | "kind" | "amount_cents"> &
          Partial<Pick<HotelPaymentRow, "id" | "folio_id" | "note" | "created_at">>,
        Partial<Pick<HotelPaymentRow, "note">>
      >;
      hotel_city_tax_config: TableDef<
        HotelCityTaxConfigRow,
        Pick<HotelCityTaxConfigRow, "organization_id"> &
          Partial<Omit<HotelCityTaxConfigRow, "organization_id">>,
        Partial<Omit<HotelCityTaxConfigRow, "organization_id">>
      >;
      hotel_invoices: TableDef<
        HotelInvoiceRow,
        Pick<HotelInvoiceRow, "organization_id"> &
          Partial<Omit<HotelInvoiceRow, "organization_id">>,
        Partial<Omit<HotelInvoiceRow, "id" | "organization_id">>
      >;
      hotel_invoice_lines: TableDef<
        HotelInvoiceLineRow,
        Pick<HotelInvoiceLineRow, "invoice_id" | "label" | "amount_cents"> &
          Partial<Pick<HotelInvoiceLineRow, "id" | "sort_order" | "created_at">>,
        Partial<Pick<HotelInvoiceLineRow, "label" | "amount_cents" | "sort_order">>
      >;
      voice_numbers: TableDef<
        VoiceNumberRow,
        Pick<VoiceNumberRow, "phone_e164" | "organization_id" | "vertical"> &
          Partial<Pick<VoiceNumberRow, "is_active" | "created_at" | "updated_at">>,
        Partial<Pick<VoiceNumberRow, "phone_e164" | "vertical" | "is_active">>
      >;
      voice_call_logs: TableDef<
        VoiceCallLogRow,
        Pick<VoiceCallLogRow, "organization_id" | "vertical"> &
          Partial<Omit<VoiceCallLogRow, "organization_id" | "vertical">>,
        Partial<Omit<VoiceCallLogRow, "id" | "organization_id">>
      >;
      aire_team_members: TableDef<
        AireTeamMemberRow,
        Pick<
          AireTeamMemberRow,
          "user_id" | "aire_id" | "organization_id"
        > & {
          created_by?: string | null;
          created_at?: string;
        },
        Partial<Pick<AireTeamMemberRow, "created_by">>
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
      is_aire_member: {
        Args: { p_aire_id: string };
        Returns: boolean;
      };
      regiaire_default_aire_id: {
        Args: { p_organization_id: string };
        Returns: string;
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
