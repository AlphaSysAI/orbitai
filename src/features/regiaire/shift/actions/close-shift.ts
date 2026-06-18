"use server";

import { z } from "zod";

import {
  CloseShiftResultSchema,
  ShiftClosureSchema,
  ShiftPeriodSchema,
  type CloseShiftResult,
  type ShiftPeriod,
} from "@/features/regiaire/shift/schemas";
import {
  getShiftClosure,
  listActiveTaskDefsForShift,
} from "@/features/regiaire/shift/shift-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

const CloseInputSchema = z.object({
  shift: ShiftPeriodSchema,
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(2000).nullable().optional(),
});

export type CloseShiftActionResult =
  | { success: true; data: CloseShiftResult }
  | { success: false; error: string; code?: string };

export async function closeShift(
  shift: ShiftPeriod,
  service_date: string,
  note?: string | null
): Promise<CloseShiftActionResult> {
  try {
    const ctx = await requireRegiaireContext();
    const parsed = CloseInputSchema.parse({ shift, service_date, note });

    const existing = await getShiftClosure(
      ctx,
      parsed.shift,
      parsed.service_date
    );
    if (existing) {
      return {
        success: true,
        data: CloseShiftResultSchema.parse({
          status: "already_closed",
          closure: existing,
        }),
      };
    }

    const defs = await listActiveTaskDefsForShift(ctx, parsed.shift);

    const { data: checksRaw, error: checksError } = await ctx.db
      .from("shift_task_checks")
      .select("task_def_id, checked")
      .eq("organization_id", ctx.organizationId)
      .eq("shift", parsed.shift)
      .eq("service_date", parsed.service_date);

    if (checksError) {
      return { success: false, error: checksError.message };
    }

    const checkedSet = new Set(
      (checksRaw ?? [])
        .filter((c) => c.checked)
        .map((c) => c.task_def_id as string)
    );

    const missing_labels: string[] = [];
    let checked_tasks = 0;

    for (const def of defs) {
      if (checkedSet.has(def.id)) {
        checked_tasks++;
      } else {
        missing_labels.push(def.label);
      }
    }

    const total_tasks = defs.length;
    const completion_pct =
      total_tasks === 0
        ? 100
        : Math.round((checked_tasks / total_tasks) * 10000) / 100;

    const { data: inserted, error: insertError } = await ctx.db
      .from("shift_closures")
      .insert({
        organization_id: ctx.organizationId,
        shift: parsed.shift,
        service_date: parsed.service_date,
        closed_by: ctx.userId,
        total_tasks,
        checked_tasks,
        completion_pct,
        missing_labels,
        note: parsed.note ?? null,
      })
      .select(
        "id, organization_id, shift, service_date, closed_by, closed_at, total_tasks, checked_tasks, completion_pct, missing_labels, note"
      )
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const closure = await getShiftClosure(
          ctx,
          parsed.shift,
          parsed.service_date
        );
        if (closure) {
          return {
            success: true,
            data: CloseShiftResultSchema.parse({
              status: "already_closed",
              closure,
            }),
          };
        }
      }
      return { success: false, error: insertError.message };
    }

    const closure = ShiftClosureSchema.parse({
      ...inserted,
      service_date: String(inserted!.service_date),
      completion_pct: Number(inserted!.completion_pct),
      missing_labels: inserted!.missing_labels ?? [],
    });

    return {
      success: true,
      data: CloseShiftResultSchema.parse({ status: "closed", closure }),
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la clôture";
    return { success: false, error: message };
  }
}
