"use server";

import { z } from "zod";

import {
  ShiftClosureSchema,
  type ShiftClosure,
} from "@/features/regiaire/shift/schemas";
import {
  OrgContextError,
  requireOrgAdminContext,
  requireOrgContext,
} from "@/lib/organizations/org-context";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

const DateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ListClosuresActionResult =
  | { success: true; data: ShiftClosure[] }
  | { success: false; error: string; code?: string };

export type GetMemberRoleActionResult =
  | { success: true; role: string; isAdmin: boolean }
  | { success: false; error: string; code?: string };

export async function getShiftMemberRole(): Promise<GetMemberRoleActionResult> {
  try {
    const ctx = await requireOrgContext();
    return {
      success: true,
      role: ctx.role,
      isAdmin: ctx.isOrgAdmin,
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur serveur" };
  }
}

export async function listClosures(
  aireId: string,
  from: string,
  to: string
): Promise<ListClosuresActionResult> {
  try {
    await requireOrgAdminContext();
    const ctx = await requireRegiaireContext(aireId);
    const range = DateRangeSchema.parse({ from, to });

    const { data, error } = await ctx.db
      .from("shift_closures")
      .select(
        "id, organization_id, shift, service_date, closed_by, closed_at, total_tasks, checked_tasks, completion_pct, missing_labels, note"
      )
      .eq("organization_id", ctx.organizationId)
      .eq("aire_id", ctx.aireId)
      .gte("service_date", range.from)
      .lte("service_date", range.to)
      .order("service_date", { ascending: false })
      .order("shift", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const closures = (data ?? []).map((row) =>
      ShiftClosureSchema.parse({
        ...row,
        service_date: String(row.service_date),
        completion_pct: Number(row.completion_pct),
        missing_labels: row.missing_labels ?? [],
      })
    );

    return { success: true, data: closures };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors du chargement" };
  }
}

/** Clôtures pour une date de service (les 3 quarts du jour). */
export async function listClosuresForDate(
  aireId: string,
  service_date: string
): Promise<ListClosuresActionResult> {
  return listClosures(aireId, service_date, service_date);
}
