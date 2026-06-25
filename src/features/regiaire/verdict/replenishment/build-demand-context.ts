// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import { getBisonFuteForecast } from "@/features/regiaire/verdict/signals/bison-fute";
import { getSchoolHolidayStatus } from "@/features/regiaire/verdict/signals/school-holidays";
import { getWeather } from "@/features/regiaire/verdict/signals/weather";
import { addDaysIso } from "@/features/regiaire/verdict/trends/iso-dates";
import type { DayDemandContext } from "@/features/regiaire/verdict/replenishment/demand-multipliers";

/** Contexte signal par jour sur l'horizon (météo, Bison Futé, vacances). */
export async function buildDayDemandContexts(
  ctx: RegiaireContext,
  planDate: string,
  horizonDays: number
): Promise<DayDemandContext[]> {
  const dates = Array.from({ length: horizonDays }, (_, i) =>
    addDaysIso(planDate, i)
  );

  const weatherSignal = await getWeather(ctx);
  const weatherByDate = new Map(
    (weatherSignal.forecast?.days ?? []).map((day) => [day.date, day])
  );

  const [bisonResults, holidayResults] = await Promise.all([
    Promise.all(dates.map((date) => getBisonFuteForecast(ctx, date))),
    Promise.all(dates.map((date) => getSchoolHolidayStatus(ctx, date))),
  ]);

  return dates.map((date, index) => ({
    date,
    weather: weatherByDate.get(date) ?? null,
    bisonLevel: bisonResults[index]?.available
      ? (bisonResults[index]!.level ?? null)
      : null,
    isOnHoliday: holidayResults[index]?.status?.isOnHoliday ?? false,
  }));
}
