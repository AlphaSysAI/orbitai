import "server-only";

import {
  WeatherForecastSchema,
  WeatherSignalSchema,
  type WeatherSignal,
} from "@/features/regiaire/verdict/schemas";
import {
  aggregateOwmForecastToDays,
  type OwmForecastItem,
} from "@/features/regiaire/verdict/lib/owm-aggregate";
import { getOwmApiKey } from "@/features/regiaire/verdict/lib/owm-api-key";
import { fetchWithTimeout } from "@/features/regiaire/verdict/lib/fetch-with-timeout";
import { getStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

const OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast";
const SIGNAL_TIMEOUT_MS = 3_000;

type OwmForecastResponse = {
  cod?: string | number;
  message?: string | number;
  list?: OwmForecastItem[];
};

function owmErrorMessage(raw: OwmForecastResponse, status: number): string {
  if (typeof raw.message === "string" && raw.message.length > 0) {
    return raw.message;
  }
  return `OpenWeatherMap indisponible (${status})`;
}

function unavailableWeather(reason: string): WeatherSignal {
  return WeatherSignalSchema.parse({
    available: false,
    forecast: null,
    reason,
  });
}

/**
 * Prévision météo J0 → J+6 via OpenWeatherMap (forecast 2.5, agrégation journalière).
 * Timeout ~3 s + fallback { available: false } — ne bloque jamais le Verdict.
 */
export async function getWeather(ctx: RegiaireContext): Promise<WeatherSignal> {
  const settings = await getStationSettings(ctx);
  if (!settings) {
    return unavailableWeather("Paramètres station manquants (lat/lon)");
  }

  const apiKey = getOwmApiKey();
  if (!apiKey) {
    return unavailableWeather("Clé OpenWeatherMap manquante (OWM_API_KEY)");
  }

  const params = new URLSearchParams({
    lat: String(settings.lat),
    lon: String(settings.lon),
    appid: apiKey,
    units: "metric",
    lang: "fr",
  });

  try {
    const response = await fetchWithTimeout(
      `${OWM_FORECAST_URL}?${params.toString()}`,
      { next: { revalidate: 3600 }, timeoutMs: SIGNAL_TIMEOUT_MS }
    );

    const raw = (await response.json()) as OwmForecastResponse;

    if (!response.ok) {
      return unavailableWeather(owmErrorMessage(raw, response.status));
    }

    const cod = String(raw.cod ?? "");
    if (cod && cod !== "200") {
      return unavailableWeather(owmErrorMessage(raw, response.status));
    }

    if (!raw.list?.length) {
      return unavailableWeather("Réponse OpenWeatherMap invalide");
    }

    const days = aggregateOwmForecastToDays(raw.list);
    if (days.length === 0) {
      return unavailableWeather("Aucune prévision sur la période J0→J+6");
    }

    const forecast = WeatherForecastSchema.parse({
      location: {
        lat: settings.lat,
        lon: settings.lon,
        city: settings.city,
      },
      days,
      fetchedAt: new Date().toISOString(),
    });

    return WeatherSignalSchema.parse({
      available: true,
      forecast,
      reason: null,
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "OpenWeatherMap timeout (>3s)"
        : error instanceof Error
          ? error.message
          : "Erreur météo";
    return unavailableWeather(reason);
  }
}

/** @deprecated Préférer getWeather qui inclut la résilience. */
export async function getWeatherForecast(ctx: RegiaireContext) {
  const signal = await getWeather(ctx);
  if (!signal.available || !signal.forecast) {
    throw new Error(signal.reason ?? "Météo indisponible");
  }
  return signal.forecast;
}
