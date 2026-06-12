import type { AiReviewQueueRow } from "@/types/database.types";

import type { ReviewType } from "./types";

export type PublishReviewContext = {
  row: AiReviewQueueRow;
  reviewType: ReviewType | string;
  userId: string;
};

export type PublishReviewResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Publie une révision approuvée vers la cible métier (Knowledge, Quiz, etc.).
 *
 * Phase C : no-op pour tous les types sauf documentation.
 * legacy_action : indexation agent_actions_index gérée dans review-service.
 * Knowledge Engine : hooks branchés en sprint ultérieur.
 */
export async function publishReview(context: PublishReviewContext): Promise<PublishReviewResult> {
  if (context.reviewType === "legacy_action") {
    return { ok: true };
  }
  return { ok: true };
}
