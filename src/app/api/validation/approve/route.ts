import { withLegacyValidationHeaders } from "@/lib/review/legacy";
import { handleReviewApprove } from "@/lib/review/review-service";

/**
 * POST /api/validation/approve
 * @deprecated Alias legacy — utiliser POST /api/review/approve
 */
export async function POST(request: Request) {
  return withLegacyValidationHeaders(await handleReviewApprove(request));
}
