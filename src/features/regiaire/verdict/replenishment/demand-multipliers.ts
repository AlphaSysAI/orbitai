// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import type { BisonFuteLevel } from "@/features/regiaire/verdict/bison-fute/schemas";
import type { WeatherDay } from "@/features/regiaire/verdict/schemas";

/** Règle heuristique v1 — libellé « à affiner » dans la doc produit. */
export type DemandMultiplierRule = {
  id: string;
  label: string;
  /** Catégories ciblées ; vide = toutes les catégories */
  categories: string[];
  factor: number;
  version: "v1-heuristique-a-affiner";
};

export const DEMAND_MULTIPLIER_RULES: DemandMultiplierRule[] = [
  {
    id: "heat-drinks",
    label:
      "Forte chaleur (tempMax ≥ 28 °C) → boissons ×1,6 [v1 heuristique à affiner]",
    categories: ["Boissons"],
    factor: 1.6,
    version: "v1-heuristique-a-affiner",
  },
  {
    id: "heat-ice-cream",
    label: "Chaleur (tempMax ≥ 25 °C) → glaces ×2 [v1 heuristique à affiner]",
    categories: ["Glaces"],
    factor: 2,
    version: "v1-heuristique-a-affiner",
  },
  {
    id: "bison-fute-red",
    label:
      "Bison Futé rouge/noir → affluence ×1,8 [v1 heuristique à affiner]",
    categories: [],
    factor: 1.8,
    version: "v1-heuristique-a-affiner",
  },
  {
    id: "school-holidays",
    label: "Vacances scolaires → ×1,3 [v1 heuristique à affiner]",
    categories: [],
    factor: 1.3,
    version: "v1-heuristique-a-affiner",
  },
];

const HEAT_DRINKS_THRESHOLD_C = 28;
const HEAT_ICE_THRESHOLD_C = 25;

export type DayDemandContext = {
  date: string;
  weather: WeatherDay | null;
  bisonLevel: BisonFuteLevel | null;
  isOnHoliday: boolean;
};

function isBisonStressLevel(level: BisonFuteLevel | null): boolean {
  return level === "rouge" || level === "noir";
}

/**
 * Multiplicateurs applicables pour une catégorie et un jour donné.
 * Retourne le produit des facteurs et les libellés des règles déclenchées.
 */
export function getCategoryMultipliersForDay(
  category: string,
  ctx: DayDemandContext
): { factor: number; reasons: string[] } {
  let factor = 1;
  const reasons: string[] = [];

  for (const rule of DEMAND_MULTIPLIER_RULES) {
    const appliesToCategory =
      rule.categories.length === 0 || rule.categories.includes(category);

    if (!appliesToCategory) continue;

    let triggered = false;

    switch (rule.id) {
      case "heat-drinks":
        triggered =
          ctx.weather != null &&
          ctx.weather.tempMaxC >= HEAT_DRINKS_THRESHOLD_C;
        break;
      case "heat-ice-cream":
        triggered =
          ctx.weather != null && ctx.weather.tempMaxC >= HEAT_ICE_THRESHOLD_C;
        break;
      case "bison-fute-red":
        triggered = isBisonStressLevel(ctx.bisonLevel);
        break;
      case "school-holidays":
        triggered = ctx.isOnHoliday;
        break;
      default:
        break;
    }

    if (triggered) {
      factor *= rule.factor;
      reasons.push(rule.label);
    }
  }

  return { factor, reasons };
}

/** Liste lisible des règles configurées (pour récap PR / doc). */
export function listDemandMultiplierRules(): DemandMultiplierRule[] {
  return [...DEMAND_MULTIPLIER_RULES];
}
