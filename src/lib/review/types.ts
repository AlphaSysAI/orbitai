import type { AiReviewQueueRow } from "@/types/database.types";

/** Types de révision supportés par l'AI Review Engine. */
export const REVIEW_TYPES = [
  "knowledge_concept",
  "knowledge_procedure",
  "knowledge_role",
  "knowledge_faq",
  "document_summary",
  "learning_path",
  "quiz",
  "expert_pattern",
  "automation_suggestion",
  "legacy_action",
] as const;

export type ReviewType = (typeof REVIEW_TYPES)[number];

export type ReviewStatus = "pending" | "approved" | "rejected";

const KNOWN_REVIEW_TYPES = new Set<string>(REVIEW_TYPES);

export function isKnownReviewType(value: string): value is ReviewType {
  return KNOWN_REVIEW_TYPES.has(value);
}

/** Mappe une action legacy OpenClaw vers review_type + original_action en metadata. */
export function legacyActionToReviewFields(action: string): {
  review_type: ReviewType;
  review_metadata: Record<string, unknown>;
  title: string;
} {
  if (isKnownReviewType(action)) {
    return {
      review_type: action,
      review_metadata: {},
      title: action,
    };
  }
  return {
    review_type: "legacy_action",
    review_metadata: { original_action: action },
    title: action,
  };
}

export function getLegacyActionLabel(row: AiReviewQueueRow): string {
  const original = row.review_metadata?.original_action;
  if (typeof original === "string" && original.length > 0) return original;
  return row.review_type;
}

/** Réponse API rétrocompatible (UI ValidationDashboard + clients legacy). */
export type ReviewApiItem = {
  id: string;
  event_id: string;
  review_id: string;
  action: string;
  review_type: string;
  payload: Record<string, unknown>;
  proposed_payload: Record<string, unknown>;
  rationale: string;
  summary: string;
  human_input_required: boolean;
  status: string;
  created_at: string;
  validated_at?: string;
  validated_by?: string;
  rejection_reason?: string;
};

export function mapReviewRowToApiItem(row: AiReviewQueueRow): ReviewApiItem {
  const action = getLegacyActionLabel(row);
  const humanInputRequired = row.review_metadata?.human_input_required;
  return {
    id: row.id,
    event_id: row.review_id,
    review_id: row.review_id,
    action,
    review_type: row.review_type,
    payload: row.proposed_payload ?? {},
    proposed_payload: row.proposed_payload ?? {},
    rationale: row.summary ?? "",
    summary: row.summary ?? "",
    human_input_required:
      typeof humanInputRequired === "boolean" ? humanInputRequired : true,
    status: row.status,
    created_at: row.created_at,
    validated_at: row.validated_at ?? undefined,
    validated_by: row.validated_by ?? undefined,
    rejection_reason: row.rejection_reason ?? undefined,
  };
}

export type ApproveReviewBody = {
  event_id?: string;
  review_id?: string;
};

export type RejectReviewBody = {
  event_id?: string;
  review_id?: string;
  reason?: string;
  rejection_reason?: string;
};

export type ValidateTaskBody = {
  task_id: string;
  status: "approved" | "rejected";
  user_id?: string;
  rejection_reason?: string;
};
