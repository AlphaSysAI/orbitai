import type { SupabaseClient } from "@supabase/supabase-js";

import { forWrite } from "@/lib/supabase-write";
import type {
  AiReviewQueueInsert,
  AiReviewQueueRow,
  AiReviewQueueUpdate,
  Database,
  ReviewStatus,
} from "@/types/database.types";

type Client = SupabaseClient<Database>;

export type ReviewFetchResult = {
  data: AiReviewQueueRow | null;
  error: Error | null;
  notFound?: boolean;
};

export async function fetchPendingReviews(
  supabase: Client,
  userId: string
): Promise<{ data: AiReviewQueueRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("ai_review_queue")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return { data: [], error };
  return { data: (data ?? []) as AiReviewQueueRow[], error: null };
}

export async function getReviewById(
  supabase: Client,
  id: string
): Promise<{ data: AiReviewQueueRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("ai_review_queue")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { data: null, error };
  return { data: data as AiReviewQueueRow, error: null };
}

export async function getReviewByReviewId(
  supabase: Client,
  reviewId: string
): Promise<ReviewFetchResult> {
  const { data, error } = await supabase
    .from("ai_review_queue")
    .select("*")
    .eq("review_id", reviewId)
    .single();

  const err = error as { code?: string } | null;
  if (err?.code === "PGRST116") {
    return { data: null, error: null, notFound: true };
  }
  if (error) return { data: null, error };
  return { data: data as AiReviewQueueRow, error: null };
}

export async function updateReviewStatus(
  supabase: Client,
  id: string,
  status: ReviewStatus,
  options?: { validated_by?: string; rejection_reason?: string; setPublishedAt?: boolean }
): Promise<{ error: Error | null }> {
  const update: AiReviewQueueUpdate = {
    status,
    updated_at: new Date().toISOString(),
    validated_at: new Date().toISOString(),
  };
  if (options?.validated_by) update.validated_by = options.validated_by;
  if (options?.rejection_reason != null) update.rejection_reason = options.rejection_reason;
  if (options?.setPublishedAt) update.published_at = new Date().toISOString();

  const { error } = await forWrite(supabase).from("ai_review_queue").update(update).eq("id", id);
  return { error: error ?? null };
}

export async function upsertReview(
  supabase: Client,
  data: AiReviewQueueInsert
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase).from("ai_review_queue").upsert(
    {
      review_id: data.review_id,
      user_id: data.user_id,
      review_type: data.review_type ?? "legacy_action",
      subject_type: data.subject_type ?? null,
      subject_id: data.subject_id ?? null,
      source_module: data.source_module ?? "legacy_openclaw",
      title: data.title ?? data.review_type ?? "legacy_action",
      summary: data.summary ?? "",
      proposed_payload: data.proposed_payload ?? {},
      source_context: data.source_context ?? {},
      status: data.status ?? "pending",
      review_metadata: data.review_metadata ?? {},
      priority: data.priority ?? 0,
    },
    { onConflict: "review_id" }
  );
  return { error: error ?? null };
}

export async function fetchApprovedReviewsPendingPublication(
  supabase: Client
): Promise<{ data: AiReviewQueueRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("ai_review_queue")
    .select("*")
    .eq("status", "approved")
    .is("published_at", null)
    .order("validated_at", { ascending: true });

  if (error) return { data: [], error };
  return { data: (data ?? []) as AiReviewQueueRow[], error: null };
}

export async function setReviewPublishedAt(
  supabase: Client,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await forWrite(supabase)
    .from("ai_review_queue")
    .update({
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return { error: error ?? null };
}

/** Réexport agent_actions_index (legacy OpenClaw approve). */
export { upsertAgentActionIndex } from "@/lib/storage";
