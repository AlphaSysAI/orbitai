// Copyright © 2026 OrbitSys. Tous droits réservés.

import { addDaysIso } from "@/features/regiaire/verdict/trends/iso-dates";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import { mapOwmConditionToWeatherCode } from "@/features/regiaire/verdict/lib/owm-weather-codes";
import type { WeatherDay } from "@/features/regiaire/verdict/schemas";

const PARIS_TZ = "Europe/Paris";

export type OwmForecastItem = {
  dt: number;
  main: {
    temp: number;
    temp_min: number;
    temp_max: number;
  };
  pop?: number;
  rain?: { "3h"?: number };
  weather?: Array<{ id: number; main?: string; description?: string }>;
};

type DayBucket = {
  temps: number[];
  tempMins: number[];
  tempMaxs: number[];
  pops: number[];
  rainMm: number;
  items: OwmForecastItem[];
};

function toParisIsoDate(unixSec: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(unixSec * 1000));
}

function getParisHour(unixSec: number): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: PARIS_TZ,
      hour: "numeric",
      hour12: false,
    }).format(new Date(unixSec * 1000))
  );
}

function pickRepresentativeOwmId(items: OwmForecastItem[]): number {
  if (items.length === 0) return 800;
  const representative = items.reduce((best, item) => {
    const hour = getParisHour(item.dt);
    const bestHour = getParisHour(best.dt);
    return Math.abs(hour - 12) < Math.abs(bestHour - 12) ? item : best;
  });
  return representative.weather?.[0]?.id ?? 800;
}

function bucketForecastByParisDate(
  list: OwmForecastItem[]
): Map<string, DayBucket> {
  const buckets = new Map<string, DayBucket>();

  for (const item of list) {
    const date = toParisIsoDate(item.dt);
    const bucket = buckets.get(date) ?? {
      temps: [],
      tempMins: [],
      tempMaxs: [],
      pops: [],
      rainMm: 0,
      items: [],
    };

    bucket.temps.push(item.main.temp);
    bucket.tempMins.push(item.main.temp_min);
    bucket.tempMaxs.push(item.main.temp_max);
    if (item.pop != null) bucket.pops.push(item.pop);
    bucket.rainMm += item.rain?.["3h"] ?? 0;
    bucket.items.push(item);
    buckets.set(date, bucket);
  }

  return buckets;
}

/** Agrège le forecast 3h OWM en 7 jours calendaires (J0→J+6, Europe/Paris). */
export function aggregateOwmForecastToDays(
  list: OwmForecastItem[]
): WeatherDay[] {
  const buckets = bucketForecastByParisDate(list);
  const start = todayParisIso();
  const targetDates = [0, 1, 2, 3, 4, 5, 6].map((offset) =>
    addDaysIso(start, offset)
  );

  const days: WeatherDay[] = [];

  for (const date of targetDates) {
    const bucket = buckets.get(date);
    if (!bucket) continue;

    const owmId = pickRepresentativeOwmId(bucket.items);
    const popMax =
      bucket.pops.length > 0
        ? Math.round(Math.max(...bucket.pops) * 1000) / 10
        : null;

    days.push({
      date,
      weatherCode: mapOwmConditionToWeatherCode(owmId),
      tempMinC: Math.min(...bucket.tempMins),
      tempMaxC: Math.max(...bucket.tempMaxs),
      precipitationMm: Math.round(bucket.rainMm * 10) / 10,
      precipitationProbMax: popMax,
    });
  }

  return days;
}
