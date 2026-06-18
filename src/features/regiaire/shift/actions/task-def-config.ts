"use server";

import { z } from "zod";

import {
  ShiftPeriodSchema,
  ShiftTaskDefSchema,
  UpsertTaskDefInputSchema,
  type ShiftPeriod,
  type ShiftTaskDef,
} from "@/features/regiaire/shift/schemas";
import {
  listAllTaskDefs,
  requireOrgAdmin,
} from "@/features/regiaire/shift/shift-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type ListTaskDefsActionResult =
  | { success: true; data: ShiftTaskDef[] }
  | { success: false; error: string; code?: string };

export type UpsertTaskDefActionResult =
  | { success: true; data: ShiftTaskDef }
  | { success: false; error: string; code?: string };

export type DeleteTaskDefActionResult =
  | { success: true }
  | { success: false; error: string; code?: string };

export type ReorderTaskDefsActionResult =
  | { success: true }
  | { success: false; error: string; code?: string };

export async function listTaskDefsConfig(
  aireId: string
): Promise<ListTaskDefsActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const admin = await requireOrgAdmin(ctx);
    if (!admin.ok) {
      return { success: false, error: admin.error };
    }

    const defs = await listAllTaskDefs(ctx);
    return {
      success: true,
      data: defs.map((d) => ShiftTaskDefSchema.parse(d)),
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors du chargement" };
  }
}

export async function upsertTaskDef(
  aireId: string,
  input: z.infer<typeof UpsertTaskDefInputSchema>
): Promise<UpsertTaskDefActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const admin = await requireOrgAdmin(ctx);
    if (!admin.ok) {
      return { success: false, error: admin.error };
    }

    const parsed = UpsertTaskDefInputSchema.parse(input);

    if (parsed.id) {
      const { data, error } = await ctx.db
        .from("shift_task_defs")
        .update({
          label: parsed.label,
          shifts: parsed.shifts,
          active: parsed.active,
        })
        .eq("id", parsed.id)
        .eq("organization_id", ctx.organizationId)
        .select(
          "id, organization_id, label, shifts, position, active, created_at"
        )
        .single();

      if (error || !data) {
        return { success: false, error: error?.message ?? "Mise à jour impossible" };
      }

      return { success: true, data: ShiftTaskDefSchema.parse(data) };
    }

    const existing = await listAllTaskDefs(ctx);
    const maxPosition = existing.reduce((m, d) => Math.max(m, d.position), -1);

    const { data, error } = await ctx.db
      .from("shift_task_defs")
      .insert({
        organization_id: ctx.organizationId,
        label: parsed.label,
        shifts: parsed.shifts,
        position: maxPosition + 1,
        active: parsed.active,
      })
      .select(
        "id, organization_id, label, shifts, position, active, created_at"
      )
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Création impossible" };
    }

    return { success: true, data: ShiftTaskDefSchema.parse(data) };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors de l'enregistrement" };
  }
}

export async function deleteTaskDef(
  aireId: string,
  taskDefId: string
): Promise<DeleteTaskDefActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const admin = await requireOrgAdmin(ctx);
    if (!admin.ok) {
      return { success: false, error: admin.error };
    }

    const { error } = await ctx.db
      .from("shift_task_defs")
      .update({ active: false })
      .eq("id", taskDefId)
      .eq("organization_id", ctx.organizationId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors de la suppression" };
  }
}

const ReorderInputSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export async function reorderTaskDefs(
  aireId: string,
  orderedIds: string[]
): Promise<ReorderTaskDefsActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const admin = await requireOrgAdmin(ctx);
    if (!admin.ok) {
      return { success: false, error: admin.error };
    }

    const parsed = ReorderInputSchema.parse({ orderedIds });

    for (let i = 0; i < parsed.orderedIds.length; i++) {
      const id = parsed.orderedIds[i]!;
      const { error } = await ctx.db
        .from("shift_task_defs")
        .update({ position: i })
        .eq("id", id)
        .eq("organization_id", ctx.organizationId);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors du réordonnancement" };
  }
}
