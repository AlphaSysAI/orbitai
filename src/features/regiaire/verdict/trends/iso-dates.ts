// Copyright © 2026 OrbitSys. Tous droits réservés.

import { IsoDateSchema } from "@/features/regiaire/verdict/schemas";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseParts(iso: string): { y: number; m: number; d: number } {
  if (!ISO_DATE.test(iso)) {
    throw new Error(`Date ISO invalide : ${iso}`);
  }
  const [y, m, d] = iso.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

/** Ajoute des jours calendaires à une date ISO (UTC). */
export function addDaysIso(iso: string, delta: number): string {
  const { y, m, d } = parseParts(iso);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

/** Semaine ISO (1–53) et jour ISO (1=lundi … 7=dimanche). */
export function getIsoWeekAndWeekday(iso: string): {
  isoYear: number;
  week: number;
  weekday: number;
} {
  IsoDateSchema.parse(iso);
  const { y, m, d } = parseParts(iso);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.getUTCDay() === 0 ? 7 : date.getUTCDay();

  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + (4 - weekday));

  const isoYear = thursday.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week =
    Math.floor(
      (thursday.getTime() - yearStart.getTime()) / 86_400_000 / 7
    ) + 1;

  return { isoYear, week, weekday };
}

/** Date calendaire pour semaine ISO + jour ISO dans une année ISO donnée. */
export function isoWeekDate(
  isoYear: number,
  week: number,
  weekday: number
): string {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Weekday = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Weekday - 1));

  const target = new Date(mondayWeek1);
  target.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7 + (weekday - 1));
  return target.toISOString().slice(0, 10);
}

/**
 * Alignement N-1 retail : même numéro de semaine ISO et même jour de la semaine,
 * sur l'année ISO précédente.
 */
export function alignedLastYear(date: string): string {
  const { isoYear, week, weekday } = getIsoWeekAndWeekday(date);
  return isoWeekDate(isoYear - 1, week, weekday);
}

/** Fenêtre glissante de N jours se terminant à `endDate` (inclus). */
export function dateWindowEnding(endDate: string, days: number): string[] {
  IsoDateSchema.parse(endDate);
  if (days < 1) throw new Error("window days must be >= 1");

  const out: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push(addDaysIso(endDate, -i));
  }
  return out;
}
