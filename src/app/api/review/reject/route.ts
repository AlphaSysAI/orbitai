// Copyright © 2026 OrbitSys. Tous droits réservés.

import { handleReviewReject } from "@/lib/review/review-service";

/**
 * POST /api/review/reject
 * Body: { event_id: string, review_id?: string, reason?: string, rejection_reason?: string }
 */
export async function POST(request: Request) {
  return handleReviewReject(request);
}
