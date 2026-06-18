"use server";

import {
  ListShiftTasksResultSchema,
  ShiftPeriodSchema,
  type ListShiftTasksResult,
  type ShiftPeriod,
} from "@/features/regiaire/shift/schemas";
import {
  getShiftClosure,
  listActiveTaskDefsForShift,
} from "@/features/regiaire/shift/shift-access";
import { serviceContext } from "@/features/regiaire/shift/service-context-core";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type ListShiftTasksActionResult =
  | { success: true; data: ListShiftTasksResult }
  | { success: false; error: string; code?: string };

export type GetCurrentServiceActionResult =
  | { success: true; data: ReturnType<typeof serviceContext> }
  | { success: false; error: string; code?: string };

export async function getCurrentServiceContext(): Promise<GetCurrentServiceActionResult> {
  try {
    await requireRegiaireContext();
    return { success: true, data: serviceContext() };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur serveur" };
  }
}

export async function listShiftTasks(
  shift?: ShiftPeriod,
  service_date?: string
): Promise<ListShiftTasksActionResult> {
  try {
    const ctx = await requireRegiaireContext();
    const svc =
      shift && service_date
        ? { shift: ShiftPeriodSchema.parse(shift), service_date }
        : serviceContext();

    const defs = await listActiveTaskDefsForShift(ctx, svc.shift);
    const closure = await getShiftClosure(ctx, svc.shift, svc.service_date);

    const { data: checksRaw, error: checksError } = await ctx.db
      .from("shift_task_checks")
      .select("task_def_id, checked, checked_by, checked_at")
      .eq("organization_id", ctx.organizationId)
      .eq("aire_id", ctx.aireId)
      .eq("shift", svc.shift)
      .eq("service_date", svc.service_date);

    if (checksError) {
      return { success: false, error: checksError.message };
    }

    const checkByDef = new Map(
      (checksRaw ?? []).map((c) => [
        c.task_def_id as string,
        {
          checked: c.checked as boolean,
          checkedBy: c.checked_by as string | null,
          checkedAt: c.checked_at as string | null,
        },
      ])
    );

    const tasks = defs.map((def) => {
      const check = checkByDef.get(def.id);
      return {
        id: def.id,
        label: def.label,
        position: def.position,
        checked: check?.checked ?? false,
        checkedAt: check?.checkedAt ?? null,
        checkedBy: check?.checkedBy ?? null,
      };
    });

    const result = ListShiftTasksResultSchema.parse({
      shift: svc.shift,
      service_date: svc.service_date,
      tasks,
      closure,
      isClosed: closure !== null,
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors du chargement";
    return { success: false, error: message };
  }
}
