// Copyright © 2026 OrbitSys. Tous droits réservés.

import { z } from "zod";

export const SecteurActionItemSchema = z.object({
  priorite: z.enum(["critique", "haute", "normale"]),
  titre: z.string(),
  detail: z.string(),
  impact_estime: z.string().nullable(),
  aire_cible: z.string().nullable(),
});
export type SecteurActionItem = z.infer<typeof SecteurActionItemSchema>;

export const SecteurVerdictRecommendationSchema = z.object({
  synthese: z.string(),
  plan_action: z.array(SecteurActionItemSchema).min(1),
  leviers_marge: z.array(z.string()),
  leviers_rendement: z.array(z.string()),
  alertes: z.array(z.string()),
});
export type SecteurVerdictRecommendation = z.infer<
  typeof SecteurVerdictRecommendationSchema
>;

export const SecteurVerdictRunSchema = z.object({
  id: z.string(),
  secteurId: z.string(),
  organizationId: z.string(),
  runDate: z.string(),
  recommendation: SecteurVerdictRecommendationSchema,
  createdAt: z.string(),
});
export type SecteurVerdictRun = z.infer<typeof SecteurVerdictRunSchema>;
