// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { z } from "zod";

import { ShiftPeriodSchema, type ShiftPeriod } from "@/features/regiaire/shift/schemas";
import { assertShiftNotClosed } from "@/features/regiaire/shift/shift-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

const ToggleInputSchema = z.object({
  shift: ShiftPeriodSchema,
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  taskDefId: z.string().uuid(),
  checked: z.boolean(),
});

export type ToggleTaskCheckActionResult =
  | { success: true }
  | { success: false; error: string; code?: string };

export async function toggleTaskCheck(
  aireId: string,
  shift: ShiftPeriod,
  service_date: string,
  taskDefId: string,
  checked: boolean
): Promise<ToggleTaskCheckActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const parsed = ToggleInputSchema.parse({
      shift,
      service_date,
      taskDefId,
      checked,
    });

    const lock = await assertShiftNotClosed(ctx, parsed.shift, parsed.service_date);
    if (!lock.ok) {
      return { success: false, error: lock.error };
    }

    const { data: def, error: defError } = await ctx.db
      .from("shift_task_defs")
      .select("id")
      .eq("id", parsed.taskDefId)
      .eq("organization_id", ctx.organizationId)
      .eq("active", true)
      .maybeSingle();

    if (defError || !def) {
      return { success: false, error: "Tâche introuvable" };
    }

    const now = new Date().toISOString();

    const { error } = await ctx.db.from("shift_task_checks").upsert(
      {
        organization_id: ctx.organizationId,
        aire_id: ctx.aireId,
        shift: parsed.shift,
        service_date: parsed.service_date,
        task_def_id: parsed.taskDefId,
        checked: parsed.checked,
        checked_by: parsed.checked ? ctx.userId : null,
        checked_at: parsed.checked ? now : null,
      },
      { onConflict: "aire_id,shift,service_date,task_def_id" }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}
