import { withLegacyValidationHeaders } from "@/lib/review/legacy";
import { handleReviewStatus } from "@/lib/review/review-service";

/**
 * GET /api/validation/status?event_id=...
 * @deprecated Alias legacy — utiliser GET /api/review/status
 */
export async function GET(request: Request) {
  return withLegacyValidationHeaders(await handleReviewStatus(request));
}
