// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { generateVerdict } from "@/features/regiaire/verdict/actions/generate-verdict";
import type { GenerateVerdictActionResult } from "@/features/regiaire/verdict/actions/generate-verdict";
import { IsoDateSchema } from "@/features/regiaire/verdict/schemas";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

/**
 * Supprime le cache du jour puis regénère (ignore le run en cache).
 */
export async function regenerateVerdict(
  aireId: string,
  targetDate?: string
): Promise<GenerateVerdictActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const runDate = targetDate
      ? IsoDateSchema.parse(targetDate)
      : todayParisIso();

    await ctx.db
      .from("verdict_runs")
      .delete()
      .eq("organization_id", ctx.organizationId)
      .eq("aire_id", ctx.aireId)
      .eq("run_date", runDate);

    return generateVerdict(aireId, runDate);
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la régénération";
    return { success: false, error: message };
  }
}
