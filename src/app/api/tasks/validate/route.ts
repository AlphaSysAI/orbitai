import { handleTaskValidate } from "@/lib/review/review-service";

export const runtime = "nodejs";

/**
 * POST /api/tasks/validate
 * Body: { task_id: string, status: "approved" | "rejected", user_id?: string, rejection_reason?: string }
 * Met à jour ai_review_queue via le service review (auth session requise).
 */
export async function POST(request: Request) {
  return handleTaskValidate(request);
}
