import { withLegacyValidationHeaders } from "@/lib/review/legacy";
import { handleReviewQueue } from "@/lib/review/review-service";

/**
 * GET /api/validation/queue
 * @deprecated Alias legacy — utiliser GET /api/review/queue
 */
export async function GET(request: Request) {
  return withLegacyValidationHeaders(await handleReviewQueue(request));
}
