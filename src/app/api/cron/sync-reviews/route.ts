// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import { getServiceClient, syncReviewsForUser } from "@/lib/reviews/google-sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();

  const { data: users } = await db
    .from("user_review_sync")
    .select("user_id")
    .not("google_places_api_key", "is", null)
    .not("google_place_id", "is", null);

  if (!users?.length) {
    return NextResponse.json({ synced: 0, total: 0 });
  }

  let successCount = 0;
  const errors: { userId: string; error: string }[] = [];

  for (const { user_id } of users) {
    try {
      await syncReviewsForUser(user_id as string, db);
      successCount++;
    } catch (err) {
      errors.push({
        userId: user_id as string,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  return NextResponse.json({
    synced: successCount,
    total: users.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
