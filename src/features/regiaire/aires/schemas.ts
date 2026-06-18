import { z } from "zod";

import { SchoolZoneSchema } from "@/features/regiaire/verdict/schemas";

export const AireSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(120),
  lat: z.number(),
  lon: z.number(),
  city: z.string().nullable(),
  schoolZone: SchoolZoneSchema,
  orderDays: z.array(z.number().int().min(1).max(7)).min(1),
  createdAt: z.string(),
});

export type Aire = z.infer<typeof AireSchema>;

export const AireInputSchema = z.object({
  name: z.string().min(1).max(120),
  city: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  schoolZone: SchoolZoneSchema,
  orderDays: z.array(z.number().int().min(1).max(7)).min(1),
});

export type AireInput = z.infer<typeof AireInputSchema>;

export const AireListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  city: z.string().nullable(),
  schoolZone: SchoolZoneSchema,
});

export type AireListItem = z.infer<typeof AireListItemSchema>;
