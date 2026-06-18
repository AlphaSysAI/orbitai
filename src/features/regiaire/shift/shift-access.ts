import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import type { ShiftClosure, ShiftPeriod } from "@/features/regiaire/shift/schemas";

const ADMIN_ROLES = new Set(["owner", "admin"]);

export async function getMemberRole(
  ctx: RegiaireContext
): Promise<string | null> {
  const { data, error } = await ctx.db
    .from("organization_members")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as string;
}

export async function requireOrgAdmin(
  ctx: RegiaireContext
): Promise<{ ok: true } | { ok: false; error: string }> {
  const role = await getMemberRole(ctx);
  if (!role || !ADMIN_ROLES.has(role)) {
    return { ok: false, error: "Accès réservé aux administrateurs" };
  }
  return { ok: true };
}

export async function getShiftClosure(
  ctx: RegiaireContext,
  shift: ShiftPeriod,
  service_date: string
): Promise<ShiftClosure | null> {
  const { data, error } = await ctx.db
    .from("shift_closures")
    .select(
      "id, organization_id, shift, service_date, closed_by, closed_at, total_tasks, checked_tasks, completion_pct, missing_labels, note"
    )
    .eq("organization_id", ctx.organizationId)
    .eq("shift", shift)
    .eq("service_date", service_date)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data,
    service_date: String(data.service_date),
    completion_pct: Number(data.completion_pct),
    missing_labels: data.missing_labels ?? [],
  } as ShiftClosure;
}

export async function assertShiftNotClosed(
  ctx: RegiaireContext,
  shift: ShiftPeriod,
  service_date: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const closure = await getShiftClosure(ctx, shift, service_date);
  if (closure) {
    return { ok: false, error: "Ce quart est clôturé — modifications impossibles" };
  }
  return { ok: true };
}

export type ShiftTaskDefRow = {
  id: string;
  organization_id: string;
  label: string;
  shifts: ShiftPeriod[];
  position: number;
  active: boolean;
  created_at: string;
};

export async function listActiveTaskDefsForShift(
  ctx: RegiaireContext,
  shift: ShiftPeriod
): Promise<ShiftTaskDefRow[]> {
  const { data, error } = await ctx.db
    .from("shift_task_defs")
    .select("id, organization_id, label, shifts, position, active, created_at")
    .eq("organization_id", ctx.organizationId)
    .eq("active", true)
    .contains("shifts", [shift])
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ShiftTaskDefRow[];
}

export async function listAllTaskDefs(
  ctx: RegiaireContext
): Promise<ShiftTaskDefRow[]> {
  const { data, error } = await ctx.db
    .from("shift_task_defs")
    .select("id, organization_id, label, shifts, position, active, created_at")
    .eq("organization_id", ctx.organizationId)
    .order("position", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ShiftTaskDefRow[];
}
