// Copyright © 2026 OrbitSys. Tous droits réservés.

import { handleReviewStatus } from "@/lib/review/review-service";

/**
 * GET /api/review/status?event_id=...
 * Polling machine (REVIEW_POLLING_TOKEN) ou lecture par propriétaire (session).
 */
export async function GET(request: Request) {
  return handleReviewStatus(request);
}
