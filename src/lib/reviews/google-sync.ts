// Copyright © 2026 OrbitSys. Tous droits réservés.

/**
 * Utilitaire partagé pour la synchronisation des avis Google Places.
 *
 * SQL migration à exécuter dans Supabase avant d'utiliser ce module :
 *
 *   CREATE TABLE IF NOT EXISTS user_review_sync (
 *     user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *     google_places_api_key TEXT,
 *     google_place_id    TEXT,
 *     google_place_name  TEXT,
 *     last_sync_at       TIMESTAMPTZ,
 *     new_reviews_count  INTEGER DEFAULT 0,
 *     total_reviews_synced INTEGER DEFAULT 0,
 *     created_at         TIMESTAMPTZ DEFAULT NOW(),
 *     updated_at         TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   ALTER TABLE user_review_sync ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "users_manage_own_review_sync" ON user_review_sync
 *     FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ReviewComment = {
  content: string;
  date?: string;
  author?: string;
  rating?: number;
};

export type PlaceInfo = {
  placeId: string;
  name: string;
  address: string;
  rating?: number;
  totalRatings?: number;
};

export type SyncResult = {
  newCount: number;
  totalCount: number;
};

export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase service_role manquante.");
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Places API helpers
// ---------------------------------------------------------------------------

export async function findPlaceByQuery(
  query: string,
  apiKey: string
): Promise<PlaceInfo | null> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json() as {
    status: string;
    error_message?: string;
    results?: { place_id: string; name: string; formatted_address: string; rating?: number; user_ratings_total?: number }[];
  };

  if (data.status === "REQUEST_DENIED") {
    throw new Error(`Google Places API refusée : ${data.error_message ?? "vérifiez que Places API est activée et que la facturation est activée dans Google Cloud Console."}`);
  }
  if (data.status === "OVER_QUERY_LIMIT") {
    throw new Error("Google Places API : quota dépassé.");
  }
  if (data.status !== "OK" || !data.results?.length) return null;

  const first = data.results[0];
  if (!first) return null;

  return {
    placeId: first.place_id,
    name: first.name,
    address: first.formatted_address,
    rating: first.rating,
    totalRatings: first.user_ratings_total,
  };
}

export async function fetchReviewsForPlaceId(
  placeId: string,
  apiKey: string
): Promise<ReviewComment[]> {
  const all: ReviewComment[] = [];
  let nextPageToken: string | null = null;
  let page = 0;

  do {
    page++;
    const base = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,reviews&key=${apiKey}`;
    const url = nextPageToken
      ? `${base}&pagetoken=${nextPageToken}`
      : base;

    if (nextPageToken) await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(url);
    const data = await res.json() as {
      status: string;
      error_message?: string;
      result?: {
        reviews?: { text?: string; time?: number; author_name?: string; rating?: number }[];
        next_page_token?: string;
      };
    };

    if (data.status === "REQUEST_DENIED") {
      throw new Error(`Google Places API refusée : ${data.error_message ?? "Places API non activée ou facturation manquante."}`);
    }
    if (data.status !== "OK") {
      if (page === 1) throw new Error(`Erreur API Google Places : ${data.error_message ?? data.status}`);
      break;
    }

    const reviews = data.result?.reviews ?? [];
    for (const r of reviews) {
      all.push({
        content: r.text ?? "",
        date: r.time ? new Date(r.time * 1000).toISOString() : undefined,
        author: r.author_name ?? undefined,
        rating: r.rating ?? undefined,
      });
    }

    nextPageToken = data.result?.next_page_token ?? null;
    if (!nextPageToken || page >= 20) break;
  } while (true);

  return all;
}

// ---------------------------------------------------------------------------
// Core sync logic
// ---------------------------------------------------------------------------

async function getOrCreateGoogleSource(
  userId: string,
  placeName: string,
  db: SupabaseClient
): Promise<string> {
  const { data: existing } = await db
    .from("client_feedback_sources")
    .select("id")
    .eq("user_id", userId)
    .eq("source_type", "review")
    .ilike("source_name", "Google Reviews%")
    .limit(1);

  if (existing?.[0]?.id) return existing[0].id as string;

  const { data: created } = await db
    .from("client_feedback_sources")
    .insert({
      user_id: userId,
      source_type: "review",
      source_name: `Google Reviews — ${placeName}`,
      auto_monitoring: true,
      monitoring_frequency: "monthly",
      is_active: true,
      total_items: 0,
    })
    .select("id")
    .single();

  if (!created?.id) throw new Error("Impossible de créer la source Google Reviews.");
  return created.id as string;
}

export async function syncReviewsForUser(
  userId: string,
  db?: SupabaseClient
): Promise<SyncResult> {
  const client = db ?? getServiceClient();

  const { data: settings } = await client
    .from("user_review_sync")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!settings?.google_places_api_key || !settings?.google_place_id) {
    throw new Error("Connexion Google non configurée pour cet utilisateur.");
  }

  const reviews = await fetchReviewsForPlaceId(
    settings.google_place_id as string,
    settings.google_places_api_key as string
  );

  const sourceId = await getOrCreateGoogleSource(
    userId,
    (settings.google_place_name as string) ?? "Établissement",
    client
  );

  let newCount = 0;
  for (const review of reviews) {
    if (!review.content.trim()) continue;

    const preview = review.content.substring(0, 100);
    const { data: dup } = await client
      .from("client_feedback_items")
      .select("id")
      .eq("source_id", sourceId)
      .eq("user_id", userId)
      .ilike("content", `${preview}%`)
      .limit(1);

    if (dup?.length) continue;

    let sentiment = "neutral";
    let sentimentScore = 0;
    if (review.rating !== undefined) {
      if (review.rating >= 4) { sentiment = "positive"; sentimentScore = (review.rating - 3) / 2; }
      else if (review.rating <= 2) { sentiment = "negative"; sentimentScore = (review.rating - 3) / 2; }
    }

    await client.from("client_feedback_items").insert({
      user_id: userId,
      source_id: sourceId,
      content: review.content,
      summary: review.content.substring(0, 200),
      rating: review.rating && review.rating >= 1 && review.rating <= 5 ? review.rating : null,
      raw_data: { author: review.author, rating: review.rating, fetched_at: new Date().toISOString() },
      channel: "review",
      category: "feedback",
      sentiment,
      sentiment_score: sentimentScore,
      urgency: "low",
      topic_tags: [],
      feedback_date: review.date ?? new Date().toISOString(),
    });

    newCount++;
  }

  const { count: total } = await client
    .from("client_feedback_items")
    .select("*", { count: "exact", head: true })
    .eq("source_id", sourceId)
    .eq("user_id", userId);

  const prevNew = (settings.new_reviews_count as number) ?? 0;

  await client.from("user_review_sync").update({
    last_sync_at: new Date().toISOString(),
    total_reviews_synced: total ?? 0,
    new_reviews_count: prevNew + newCount,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await client.from("client_feedback_sources").update({
    total_items: total ?? 0,
    last_sync_at: new Date().toISOString(),
  }).eq("id", sourceId);

  return { newCount, totalCount: total ?? 0 };
}
