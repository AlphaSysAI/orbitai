import { withLegacyValidationHeaders } from "@/lib/review/legacy";
import { handleReviewReject } from "@/lib/review/review-service";

/**
 * POST /api/validation/reject
 * @deprecated Alias legacy — utiliser POST /api/review/reject
 */
export async function POST(request: Request) {
  return withLegacyValidationHeaders(await handleReviewReject(request));
}
