// Copyright © 2026 OrbitSys. Tous droits réservés.

import { z } from "zod";

/** Statuts possibles d'un événement logué par OpenClaw */
export const OpenClawEventStatus = z.enum([
  "pending_validation",
  "executed",
  "failed",
]);
export type OpenClawEventStatus = z.infer<typeof OpenClawEventStatus>;

/** Schéma JSON strict pour un événement de log OpenClaw */
export const OpenClawLogEventSchema = z.object({
  event_id: z.string().uuid(),
  timestamp: z.string().datetime({ offset: true }),
  action: z.string().min(1),
  status: OpenClawEventStatus,
  payload: z.record(z.unknown()),
  rationale: z.string(),
  human_input_required: z.boolean(),
  /** Optionnel : UUID de l'utilisateur OrbitAI (pour ValidationQueue / agent_actions_index) */
  user_id: z.string().uuid().optional(),
});

export type OpenClawLogEvent = z.infer<typeof OpenClawLogEventSchema>;

/** Valide un objet inconnu comme événement de log ; lance si invalide */
export function parseOpenClawLogEvent(raw: unknown): OpenClawLogEvent {
  return OpenClawLogEventSchema.parse(raw);
}

/** Valide et retourne l'événement ou null si invalide (pour traitement par lot) */
export function safeParseOpenClawLogEvent(
  raw: unknown
): { success: true; data: OpenClawLogEvent } | { success: false; error: z.ZodError } {
  const result = OpenClawLogEventSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// --- Échange Inbox (fichiers JSON) ---

/** Événement résumé dans un rapport journalier */
export const DailyReportEventItemSchema = z.object({
  action: z.string().optional(),
  summary: z.string().optional(),
  status: z.string().optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
  payload: z.record(z.unknown()).optional(),
});

/** Schéma pour un fichier de rapport journalier (inbox/reports) */
export const DailyReportSchema = z.object({
  report_id: z.string().uuid().optional(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format ISO YYYY-MM-DD"),
  summary: z.string(),
  events: z.array(DailyReportEventItemSchema).default([]),
  user_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type DailyReport = z.infer<typeof DailyReportSchema>;
export type DailyReportEventItem = z.infer<typeof DailyReportEventItemSchema>;

/** Valide un objet comme rapport journalier */
export function safeParseDailyReport(
  raw: unknown
): { success: true; data: DailyReport } | { success: false; error: z.ZodError } {
  const result = DailyReportSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

/** Schéma pour une demande de validation (inbox/validation) – un fichier = une requête */
export const ValidationRequestSchema = z.object({
  event_id: z.string().uuid(),
  action: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  rationale: z.string().default(""),
  human_input_required: z.boolean().default(true),
  user_id: z.string().uuid().optional(),
  timestamp: z.string().datetime({ offset: true }).optional(),
});

export type ValidationRequest = z.infer<typeof ValidationRequestSchema>;

/** Valide un objet comme demande de validation */
export function safeParseValidationRequest(
  raw: unknown
): { success: true; data: ValidationRequest } | { success: false; error: z.ZodError } {
  const result = ValidationRequestSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// --- Skills (manifest pour synchronisation dynamique) ---

/** Schéma du manifest d’un skill OpenClaw (cache local data/skills/). */
export const SkillManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  action_type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
  hash: z.string(),
});

export type SkillManifest = z.infer<typeof SkillManifestSchema>;

export function safeParseSkillManifest(
  raw: unknown
): { success: true; data: SkillManifest } | { success: false; error: z.ZodError } {
  const result = SkillManifestSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
