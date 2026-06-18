import "server-only";

import {
  WeatherForecastSchema,
  type WeatherForecast,
} from "@/features/regiaire/verdict/schemas";
import { requireStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

const OPEN_METEO_FORECAST =
  "https://api.open-meteo.com/v1/forecast";

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
 * Coordonnées lues depuis regiaire_station_settings.
 */
export async function getWeather(ctx: RegiaireContext): Promise<WeatherForecast> {
  const settings = await requireStationSettings(ctx);

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

  const response = await fetch(`${OPEN_METEO_FORECAST}?${params.toString()}`, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo indisponible (${response.status})`);
  }

  const raw = (await response.json()) as OpenMeteoResponse;
  const daily = raw.daily;

  if (!daily?.time?.length) {
    throw new Error("Réponse Open-Meteo invalide");
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

  return WeatherForecastSchema.parse({
    location: {
      lat: settings.lat,
      lon: settings.lon,
      city: settings.city,
    },
    days,
    fetchedAt: new Date().toISOString(),
  });
}
