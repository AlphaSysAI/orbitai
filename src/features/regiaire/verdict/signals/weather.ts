import "server-only";

import {
  WeatherForecastSchema,
  WeatherSignalSchema,
  type WeatherSignal,
} from "@/features/regiaire/verdict/schemas";
import { fetchWithTimeout } from "@/features/regiaire/verdict/lib/fetch-with-timeout";
import { getStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const SIGNAL_TIMEOUT_MS = 3_000;

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_sum?: number[];
  precipitation_probability_max?: (number | null)[];
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
};

/**
 * Prévision météo J0 → J+3 via Open-Meteo (gratuit, sans clé).
 * Timeout ~3 s + fallback { available: false } — ne bloque jamais le Verdict.
 */
export async function getWeather(ctx: RegiaireContext): Promise<WeatherSignal> {
  const settings = await getStationSettings(ctx);
  if (!settings) {
    return WeatherSignalSchema.parse({
      available: false,
      reason: "Paramètres station manquants (lat/lon)",
    });
  }

  const params = new URLSearchParams({
    latitude: String(settings.lat),
    longitude: String(settings.lon),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
    ].join(","),
    timezone: "Europe/Paris",
    forecast_days: "4",
  });

  try {
    const response = await fetchWithTimeout(
      `${OPEN_METEO_FORECAST}?${params.toString()}`,
      { next: { revalidate: 3600 }, timeoutMs: SIGNAL_TIMEOUT_MS }
    );

    if (!response.ok) {
      return WeatherSignalSchema.parse({
        available: false,
        reason: `Open-Meteo indisponible (${response.status})`,
      });
    }

    const raw = (await response.json()) as OpenMeteoResponse;
    const daily = raw.daily;

    if (!daily?.time?.length) {
      return WeatherSignalSchema.parse({
        available: false,
        reason: "Réponse Open-Meteo invalide",
      });
    }

    const days = daily.time.slice(0, 4).map((date, index) => ({
      date,
      weatherCode: daily.weather_code?.[index] ?? 0,
      tempMaxC: daily.temperature_2m_max?.[index] ?? 0,
      tempMinC: daily.temperature_2m_min?.[index] ?? 0,
      precipitationMm: daily.precipitation_sum?.[index] ?? 0,
      precipitationProbMax:
        daily.precipitation_probability_max?.[index] ?? null,
    }));

    const forecast = WeatherForecastSchema.parse({
      location: {
        lat: settings.lat,
        lon: settings.lon,
        city: settings.city,
      },
      days,
      fetchedAt: new Date().toISOString(),
    });

    return WeatherSignalSchema.parse({ available: true, forecast });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "Open-Meteo timeout (>3s)"
        : error instanceof Error
          ? error.message
          : "Erreur météo";
    return WeatherSignalSchema.parse({ available: false, reason });
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
