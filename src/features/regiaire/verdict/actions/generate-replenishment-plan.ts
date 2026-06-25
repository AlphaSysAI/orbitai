// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { IsoDateSchema } from "@/features/regiaire/verdict/schemas";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import { computeReplenishmentPlan } from "@/features/regiaire/verdict/replenishment/compute-plan";
import type { ReplenishmentPlan } from "@/features/regiaire/verdict/replenishment/schemas";
import { resolveRegiaireCapabilities } from "@/lib/regiaire/regiaire-capabilities";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type GenerateReplenishmentPlanResult =
  | { success: true; data: ReplenishmentPlan }
  | { success: false; error: string; code?: string };

/**
 * Plan de réapprovisionnement déterministe (unités réelles, horizon 7 j).
 * Pas de narration IA — sortie structurée pour l'étape B.
 */
export async function generateReplenishmentPlan(
  aireId: string,
  date?: string
): Promise<GenerateReplenishmentPlanResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const caps = await resolveRegiaireCapabilities(ctx);
    if (!caps.canViewVerdict) {
      return {
        success: false,
        error: "Accès réservé au gérant ou à l'administration",
        code: "forbidden",
      };
    }
    const planDate = date ? IsoDateSchema.parse(date) : todayParisIso();
    const plan = await computeReplenishmentPlan(ctx, planDate);
    return { success: true, data: plan };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error
        ? error.message
        : "Erreur lors du calcul du plan de réappro";
    return { success: false, error: message };
  }
}
