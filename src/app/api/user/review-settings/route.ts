// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import {
  findPlaceByQuery,
  getServiceClient,
  syncReviewsForUser,
} from "@/lib/reviews/google-sync";
import { getAuthenticatedUserFromRequest } from "@/server/auth/supabase-server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const db = getServiceClient();
  const { data } = await db
    .from("user_review_sync")
    .select("google_place_id, google_place_name, last_sync_at, new_reviews_count, total_reviews_synced, google_places_api_key")
    .eq("user_id", user.id)
    .single();

  if (!data) {
    return NextResponse.json({ connected: false, newReviewsCount: 0, totalReviewsSynced: 0 });
  }

  return NextResponse.json({
    connected: !!(data.google_place_id && data.google_places_api_key),
    placeName: data.google_place_name ?? null,
    placeId: data.google_place_id ?? null,
    hasKey: !!data.google_places_api_key,
    lastSyncAt: data.last_sync_at ?? null,
    newReviewsCount: (data.new_reviews_count as number) ?? 0,
    totalReviewsSynced: (data.total_reviews_synced as number) ?? 0,
  });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const { action } = body;
  const db = getServiceClient();

  // Chercher un établissement sans sauvegarder
  if (action === "search") {
    const { apiKey, businessQuery } = body;
    if (typeof apiKey !== "string" || !apiKey || typeof businessQuery !== "string" || !businessQuery) {
      return NextResponse.json({ error: "apiKey et businessQuery requis" }, { status: 400 });
    }
    try {
      const place = await findPlaceByQuery(businessQuery, apiKey);
      if (!place) {
        return NextResponse.json(
          { error: `Aucun établissement trouvé pour "${businessQuery}". Vérifiez le nom de votre fiche Google.` },
          { status: 404 }
        );
      }
      return NextResponse.json({ place });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur API Google" }, { status: 502 });
    }
  }

  // Connecter : sauvegarder + sync initial
  if (action === "connect") {
    const { apiKey, placeId, placeName } = body;
    if (typeof apiKey !== "string" || !apiKey || typeof placeId !== "string" || !placeId) {
      return NextResponse.json({ error: "apiKey et placeId requis" }, { status: 400 });
    }

    await db.from("user_review_sync").upsert(
      {
        user_id: user.id,
        google_places_api_key: apiKey,
        google_place_id: placeId,
        google_place_name: typeof placeName === "string" ? placeName : null,
        new_reviews_count: 0,
        total_reviews_synced: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    try {
      const result = await syncReviewsForUser(user.id, db);
      return NextResponse.json({ success: true, newReviews: result.newCount, total: result.totalCount });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur sync" }, { status: 500 });
    }
  }

  // Sync manuel
  if (action === "sync") {
    try {
      const result = await syncReviewsForUser(user.id, db);
      return NextResponse.json({ success: true, newReviews: result.newCount, total: result.totalCount });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Erreur sync" }, { status: 500 });
    }
  }

  // Réinitialiser le compteur de notifications
  if (action === "dismiss") {
    await db
      .from("user_review_sync")
      .update({ new_reviews_count: 0, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  // Déconnecter
  if (action === "disconnect") {
    await db.from("user_review_sync").delete().eq("user_id", user.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
