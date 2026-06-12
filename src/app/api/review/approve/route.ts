import { handleReviewApprove } from "@/lib/review/review-service";

/**
 * POST /api/review/approve
 * Body: { event_id: string, review_id?: string }
 */
export async function POST(request: Request) {
  return handleReviewApprove(request);
}
