// Copyright © 2026 OrbitSys. Tous droits réservés.

import { z } from "zod";

export const ShiftPeriodSchema = z.enum(["matin", "apres_midi", "nuit"]);
export type ShiftPeriod = z.infer<typeof ShiftPeriodSchema>;

export const SHIFT_PERIOD_LABELS: Record<ShiftPeriod, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  nuit: "Nuit",
};

export const ALL_SHIFT_PERIODS: ShiftPeriod[] = ["matin", "apres_midi", "nuit"];

export const ShiftTaskDefSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  label: z.string().min(1),
  shifts: z.array(ShiftPeriodSchema).min(1),
  position: z.number().int(),
  active: z.boolean(),
  created_at: z.string(),
});

export type ShiftTaskDef = z.infer<typeof ShiftTaskDefSchema>;

export const ShiftTaskWithCheckSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  position: z.number().int(),
  checked: z.boolean(),
  checkedAt: z.string().nullable(),
  checkedBy: z.string().uuid().nullable(),
});

export type ShiftTaskWithCheck = z.infer<typeof ShiftTaskWithCheckSchema>;

export const ShiftClosureSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  shift: ShiftPeriodSchema,
  service_date: z.string(),
  closed_by: z.string().uuid(),
  closed_at: z.string(),
  total_tasks: z.number().int(),
  checked_tasks: z.number().int(),
  completion_pct: z.number(),
  missing_labels: z.array(z.string()),
  note: z.string().nullable(),
});

export type ShiftClosure = z.infer<typeof ShiftClosureSchema>;

export const ServiceContextSchema = z.object({
  shift: ShiftPeriodSchema,
  service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ServiceContext = z.infer<typeof ServiceContextSchema>;

export const ListShiftTasksResultSchema = z.object({
  shift: ShiftPeriodSchema,
  service_date: z.string(),
  tasks: z.array(ShiftTaskWithCheckSchema),
  closure: ShiftClosureSchema.nullable(),
  isClosed: z.boolean(),
});

export type ListShiftTasksResult = z.infer<typeof ListShiftTasksResultSchema>;

export const CloseShiftResultSchema = z.object({
  status: z.enum(["closed", "already_closed"]),
  closure: ShiftClosureSchema,
});

export type CloseShiftResult = z.infer<typeof CloseShiftResultSchema>;

export const UpsertTaskDefInputSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(200),
  shifts: z.array(ShiftPeriodSchema).min(1),
  active: z.boolean().optional().default(true),
});

export type UpsertTaskDefInput = z.infer<typeof UpsertTaskDefInputSchema>;

export const ShiftVerdictSchema = z.object({
  tendance: z.enum(["amelioration", "stable", "degradation"]),
  synthese: z.string().max(700),
  points_critiques: z
    .array(
      z.object({
        tache: z.string(),
        detail: z.string().max(280),
      })
    )
    .max(5),
  recommandations: z.array(z.string().max(220)).max(4),
  alerte: z.string().max(400).nullable(),
});

export type ShiftVerdict = z.infer<typeof ShiftVerdictSchema>;

export function formatServiceDateFr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTimeFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
