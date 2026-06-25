// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

export type BanAddressSuggestion = {
  label: string;
  city: string | null;
  postcode: string | null;
  lat: number;
  lon: number;
};

type BanFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    label: string;
    city?: string;
    postcode?: string;
  };
};

type BanSearchResponse = {
  features?: BanFeature[];
};

/**
 * Recherche d'adresses via la Base Adresse Nationale (data.gouv.fr).
 * Gratuit, sans clé API — adapté aux aires autoroutières en France.
 */
export async function searchBanAddresses(
  query: string
): Promise<BanAddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "8");
  url.searchParams.set("autocomplete", "1");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as BanSearchResponse;

  return (data.features ?? []).map((feature) => ({
    label: feature.properties.label,
    city: feature.properties.city ?? null,
    postcode: feature.properties.postcode ?? null,
    lat: feature.geometry.coordinates[1]!,
    lon: feature.geometry.coordinates[0]!,
  }));
}
