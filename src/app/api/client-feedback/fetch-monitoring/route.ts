// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type ReviewComment = { content: string; date?: string; author?: string; rating?: number };

export async function POST(request: Request) {
  try {
    const { sourceId, userId } = await request.json();

    if (!sourceId || !userId) {
      return NextResponse.json({ error: 'sourceId et userId requis' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: sourcesById, error: sourceByIdError } = await supabase
      .from('client_feedback_sources')
      .select('*')
      .eq('id', sourceId)
      .limit(1);

    if (sourceByIdError) {
      return NextResponse.json(
        { error: `Erreur lors de la récupération de la source: ${sourceByIdError.message}` },
        { status: 500 }
      );
    }

    if (!sourcesById || sourcesById.length === 0) {
      return NextResponse.json({ error: `Source non trouvée avec l'ID: ${sourceId}` }, { status: 404 });
    }

    const source = sourcesById[0];

    if (source.user_id !== userId) {
      return NextResponse.json({ error: `Source non autorisée` }, { status: 403 });
    }

    if (!source.monitoring_url) {
      return NextResponse.json(
        { error: 'Aucune URL configurée pour cette source' },
        { status: 400 }
      );
    }

    if (!isValidMonitoringUrl(source.monitoring_url)) {
      return NextResponse.json(
        { error: 'URL invalide. Utilisez une URL Google Maps (/maps/place/...), une URL de recherche Google, ou Trustpilot.' },
        { status: 400 }
      );
    }

    const url: string = source.monitoring_url;
    const isGoogleMaps = url.includes('google.com/maps') || url.includes('maps.google.com');
    const isGoogleSearch = url.includes('google.com/search');
    const isTrustpilot = url.includes('trustpilot.com');
    const isGoogleSource = isGoogleMaps || isGoogleSearch;

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (isGoogleSource && !apiKey) {
      return NextResponse.json({
        success: true,
        message: '✅ URL valide ! La récupération automatique des avis nécessite une clé API Google Places (GOOGLE_PLACES_API_KEY). La source est enregistrée.',
        fetched: 0,
        items: [],
        requires_api: true,
      });
    }

    let comments: ReviewComment[] = [];
    let fetchError: string | null = null;

    try {
      if (isGoogleMaps) {
        comments = await fetchGoogleReviewsFromMapsUrl(url, apiKey!);
      } else if (isGoogleSearch) {
        comments = await fetchGoogleReviewsFromSearchUrl(url, apiKey!);
      } else if (isTrustpilot) {
        comments = await fetchTrustpilotReviews(url);
      } else {
        comments = await fetchGenericReviews(url);
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : 'Erreur inconnue lors de la récupération des avis';
    }

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError, fetched: 0, items: [] }, { status: 500 });
    }

    if (comments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun avis récupéré — l\'établissement n\'a peut-être pas encore d\'avis, ou les avis existants ont déjà été importés.',
        fetched: 0,
        items: [],
      });
    }

    const newItems = [];
    let skippedCount = 0;

    for (const comment of comments) {
      const contentPreview = comment.content.substring(0, 100);

      const { data: existingItems } = await supabase
        .from('client_feedback_items')
        .select('id')
        .eq('source_id', source.id)
        .eq('user_id', userId)
        .ilike('content', `${contentPreview}%`)
        .limit(1);

      if (existingItems && existingItems.length > 0) {
        skippedCount++;
        continue;
      }

      let sentiment = 'neutral';
      let sentimentScore = 0;
      if (comment.rating !== undefined) {
        if (comment.rating >= 4) {
          sentiment = 'positive';
          sentimentScore = (comment.rating - 3) / 2;
        } else if (comment.rating <= 2) {
          sentiment = 'negative';
          sentimentScore = (comment.rating - 3) / 2;
        }
      }

      const { data: item, error: itemError } = await supabase
        .from('client_feedback_items')
        .insert({
          user_id: userId,
          source_id: source.id,
          content: comment.content,
          summary: comment.content.substring(0, 200),
          rating: comment.rating && comment.rating >= 1 && comment.rating <= 5 ? comment.rating : null,
          raw_data: {
            author: comment.author,
            rating: comment.rating,
            fetched_at: new Date().toISOString(),
          },
          channel: 'review',
          category: 'feedback',
          sentiment,
          sentiment_score: sentimentScore,
          urgency: 'low',
          topic_tags: [],
          feedback_date: comment.date ? new Date(comment.date).toISOString() : new Date().toISOString(),
        })
        .select()
        .single();

      if (!itemError && item) {
        newItems.push(item);
      }
    }

    const { count: totalCount } = await supabase
      .from('client_feedback_items')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', source.id)
      .eq('user_id', userId);

    await supabase
      .from('client_feedback_sources')
      .update({
        last_sync_at: new Date().toISOString(),
        total_items: totalCount || 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', source.id);

    return NextResponse.json({
      success: true,
      fetched: newItems.length,
      total_available: comments.length,
      skipped: skippedCount,
      items: newItems,
      message: newItems.length > 0
        ? `${newItems.length} nouveau(x) avis récupéré(s)${skippedCount > 0 ? `, ${skippedCount} doublon(s) ignoré(s)` : ''}`
        : skippedCount > 0
          ? `${skippedCount} avis déjà enregistrés, aucun nouveau`
          : 'Aucun avis récupéré',
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur lors de la récupération';
    console.error('Error fetching monitoring:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isValidMonitoringUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  return true;
}

/**
 * Récupère les avis depuis une URL Google Maps (/maps/place/...)
 */
async function fetchGoogleReviewsFromMapsUrl(url: string, apiKey: string): Promise<ReviewComment[]> {
  if (!url.includes('/place/')) {
    throw new Error('URL Google Maps invalide — elle doit contenir "/place/".');
  }

  const placeMatch = url.match(/\/place\/([^/@]+)/);
  const coordsMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);

  if (!placeMatch?.[1]) {
    throw new Error('Impossible d\'extraire le nom de l\'établissement depuis l\'URL Google Maps.');
  }

  const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));

  if (coordsMatch?.[1] && coordsMatch[2]) {
    const lat = coordsMatch[1];
    const lng = coordsMatch[2];
    const placeId = await findPlaceIdByNameAndCoords(placeName, lat, lng, apiKey);
    if (placeId) return fetchReviewsForPlaceId(placeId, apiKey);
  }

  // Fallback sans coordonnées
  const placeId = await findPlaceIdByQuery(placeName, apiKey);
  if (placeId) return fetchReviewsForPlaceId(placeId, apiKey);

  throw new Error(`Établissement "${placeName}" introuvable via Google Places. Vérifiez le nom ou utilisez une URL Search.`);
}

/**
 * Récupère les avis depuis une URL de recherche Google (google.com/search?q=...)
 */
async function fetchGoogleReviewsFromSearchUrl(url: string, apiKey: string): Promise<ReviewComment[]> {
  let query: string | null = null;
  try {
    const parsed = new URL(url);
    query = parsed.searchParams.get('q');
  } catch {
    throw new Error('URL de recherche Google invalide.');
  }

  if (!query) {
    throw new Error('Paramètre "q" manquant dans l\'URL de recherche Google.');
  }

  console.log('[fetch-monitoring] Recherche Places pour query:', query);

  const placeId = await findPlaceIdByQuery(query, apiKey);
  if (!placeId) {
    throw new Error(`Aucun établissement trouvé pour "${query}" via Google Places Text Search. Vérifiez que le nom correspond exactement à votre fiche Google.`);
  }

  return fetchReviewsForPlaceId(placeId, apiKey);
}

/**
 * Trouve un place_id via Text Search (nom + coordonnées)
 */
async function findPlaceIdByNameAndCoords(
  name: string,
  lat: string,
  lng: string,
  apiKey: string
): Promise<string | null> {
  try {
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(name)}&location=${lat},${lng}&radius=50&key=${apiKey}`;
    const res = await fetch(searchUrl);
    const data = await res.json();

    if (data.status === 'OK' && data.results?.length > 0) {
      return data.results[0].place_id as string;
    }

    // Fallback geocoding inverse
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    const geoRes = await fetch(geocodeUrl);
    const geoData = await geoRes.json();

    if (geoData.status === 'OK' && geoData.results?.length > 0) {
      const match = geoData.results.find((r: { place_id?: string; types?: string[] }) =>
        r.place_id && r.types?.some((t: string) =>
          ['establishment', 'point_of_interest', 'store', 'restaurant'].includes(t)
        )
      ) ?? geoData.results[0];
      return match?.place_id ?? null;
    }
  } catch (error) {
    console.error('[fetch-monitoring] Erreur findPlaceIdByNameAndCoords:', error);
  }
  return null;
}

/**
 * Trouve un place_id via Text Search (query libre) — lève une erreur si l'API refuse
 */
async function findPlaceIdByQuery(query: string, apiKey: string): Promise<string | null> {
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(searchUrl);
  const data = await res.json() as { status: string; error_message?: string; results?: { place_id: string; name: string }[] };

  if (data.status === 'REQUEST_DENIED') {
    throw new Error(`Google Places API : accès refusé — ${data.error_message ?? 'vérifiez que "Places API" est bien activée dans Google Cloud Console et que la clé n\'est pas restreinte.'}`);
  }
  if (data.status === 'OVER_QUERY_LIMIT') {
    throw new Error('Google Places API : quota dépassé. Vérifiez votre consommation dans Google Cloud Console.');
  }
  if (data.status === 'INVALID_REQUEST') {
    throw new Error(`Google Places API : requête invalide — ${data.error_message ?? 'paramètres incorrects'}.`);
  }

  if (data.status === 'OK' && data.results && data.results.length > 0) {
    const first = data.results[0];
    if (first) {
      console.log('[fetch-monitoring] Place trouvé:', first.name, '— place_id:', first.place_id);
      return first.place_id;
    }
  }

  // ZERO_RESULTS : pas une erreur d'API, juste aucun résultat
  return null;
}

/**
 * Récupère tous les avis Google disponibles pour un place_id (avec pagination)
 */
async function fetchReviewsForPlaceId(placeId: string, apiKey: string): Promise<ReviewComment[]> {
  const allComments: ReviewComment[] = [];
  let nextPageToken: string | null = null;
  let pageCount = 0;
  const maxPages = 20;

  do {
    pageCount++;
    let placesUrl: string;

    if (nextPageToken) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}&pagetoken=${nextPageToken}`;
    } else {
      placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}`;
    }

    const res = await fetch(placesUrl);
    const data = await res.json();

    if (data.status !== 'OK') {
      if (data.status === 'INVALID_REQUEST' && nextPageToken) break;
      if (pageCount === 1) throw new Error(`Erreur API Google Places: ${data.error_message ?? data.status}`);
      break;
    }

    if (data.result?.reviews?.length > 0) {
      const pageComments: ReviewComment[] = data.result.reviews.map((review: {
        text?: string;
        time?: number;
        author_name?: string;
        rating?: number;
      }) => ({
        content: review.text ?? '',
        date: review.time ? new Date(review.time * 1000).toISOString() : undefined,
        author: review.author_name ?? undefined,
        rating: review.rating ?? undefined,
      }));

      allComments.push(...pageComments);
      nextPageToken = data.result.next_page_token ?? null;
      if (!nextPageToken) break;
    } else {
      nextPageToken = null;
    }

    if (pageCount >= maxPages) break;
  } while (nextPageToken);

  console.log(`[fetch-monitoring] ${allComments.length} avis récupérés pour place_id ${placeId}`);
  return allComments;
}

async function fetchTrustpilotReviews(_url: string): Promise<ReviewComment[]> {
  // TODO: Trustpilot Business API
  return [];
}

async function fetchGenericReviews(_url: string): Promise<ReviewComment[]> {
  // TODO: Puppeteer/Cheerio scraping
  return [];
}
