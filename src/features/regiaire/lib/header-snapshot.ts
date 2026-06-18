import "server-only";

import { z } from "zod";

import { weatherDayLabel } from "@/features/regiaire/verdict/lib/weather-labels";
import { getWeather } from "@/features/regiaire/verdict/signals/weather";
import { getStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import { requireRegiaireContext } from "@/lib/regiaire/require-context";

export const RegiaireHeaderWeatherSchema = z.discriminatedUnion("available", [
  z.object({
    available: z.literal(true),
    label: z.string(),
    tempMinC: z.number(),
    tempMaxC: z.number(),
    weatherCode: z.number().int(),
  }),
  z.object({
    available: z.literal(false),
    reason: z.string().optional(),
  }),
]);

export const RegiaireHeaderSnapshotSchema = z.object({
  stationName: z.string().nullable(),
  weather: RegiaireHeaderWeatherSchema,
});

export type RegiaireHeaderSnapshot = z.infer<typeof RegiaireHeaderSnapshotSchema>;

export async function loadRegiaireHeaderSnapshot(
  aireId: string
): Promise<RegiaireHeaderSnapshot> {
  const ctx = await requireRegiaireContext(aireId);
  const [settings, weatherSignal] = await Promise.all([
    getStationSettings(ctx),
    getWeather(ctx),
  ]);

  const today = weatherSignal.forecast?.days[0];

  const weather =
    weatherSignal.available && today
      ? {
          available: true as const,
          label: weatherDayLabel(today.weatherCode),
          tempMinC: today.tempMinC,
          tempMaxC: today.tempMaxC,
          weatherCode: today.weatherCode,
        }
      : {
          available: false as const,
          reason: weatherSignal.reason ?? "Météo indisponible",
        };

  return RegiaireHeaderSnapshotSchema.parse({
    stationName: settings?.city ?? null,
    weather,
  });
}
