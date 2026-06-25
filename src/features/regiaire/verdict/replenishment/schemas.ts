// Copyright © 2026 OrbitSys. Tous droits réservés.

import { z } from "zod";

import { IsoDateSchema } from "@/features/regiaire/verdict/schemas";

export const REPLENISHMENT_HORIZON_DAYS = 7;
export const REPLENISHMENT_BASELINE_WEEKS = 12;
export const REPLENISHMENT_TOP_SELLERS_PER_CATEGORY = 3;
export const REPLENISHMENT_SAFETY_MARGIN = 1.1;

export const ReplenishmentSupplierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  leadTimeDays: z.number().int().nonnegative(),
});

export type ReplenishmentSupplier = z.infer<typeof ReplenishmentSupplierSchema>;

export const ReplenishmentProductSchema = z.object({
  id: z.string().uuid(),
  ean: z.string(),
  name: z.string(),
  category: z.string(),
});

export type ReplenishmentProduct = z.infer<typeof ReplenishmentProductSchema>;

export const ReplenishmentLineSchema = z.object({
  product: ReplenishmentProductSchema,
  category: z.string(),
  currentStock: z.number().nonnegative(),
  projectedDemand: z.number().nonnegative(),
  suggestedOrderQty: z.number().int().nonnegative(),
  orderByDate: IsoDateSchema.nullable(),
  supplier: ReplenishmentSupplierSchema.nullable(),
  reason: z.array(z.string()),
});

export type ReplenishmentLine = z.infer<typeof ReplenishmentLineSchema>;

export const ReplenishmentPlanSchema = z.object({
  aireId: z.string().uuid(),
  organizationId: z.string().uuid(),
  planDate: IsoDateSchema,
  horizonDays: z.number().int().positive(),
  lines: z.array(ReplenishmentLineSchema),
  /**
   * v1 : les commandes déjà passées ne sont pas déduites du stock projeté ni du manque.
   * Angle mort documenté — à traiter quand le suivi commandes existera.
   */
  v1Limitations: z.array(z.string()),
});

export type ReplenishmentPlan = z.infer<typeof ReplenishmentPlanSchema>;
