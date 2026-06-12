import {
  handleReviewQueue,
} from "@/lib/review/review-service";

/**
 * GET /api/review/queue
 * Liste les révisions pending de l'utilisateur authentifié (AI Review Engine).
 */
export async function GET(request: Request) {
  return handleReviewQueue(request);
}
