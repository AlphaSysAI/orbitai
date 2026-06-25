// Copyright © 2026 OrbitSys. Tous droits réservés.

import { z } from "zod";

import { BisonFuteZoneSchema } from "@/features/regiaire/verdict/bison-fute/schemas";

export const AdminClientAireSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  address: z.string().min(5).max(255),
  city: z.string().max(120).optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  schoolZone: z.enum(["A", "B", "C"]),
  orderDays: z.array(z.number().int().min(1).max(7)).min(1),
  bisonFuteZone: BisonFuteZoneSchema.nullable().optional(),
});

export type AdminClientAireInput = z.infer<typeof AdminClientAireSchema>;

export type AdminClientAireRecord = AdminClientAireInput & {
  id: string;
  emailSlug?: string | null;
};

export const AdminClientAiresPayloadSchema = z.object({
  aires: z.array(AdminClientAireSchema),
});

export function emptyAireDraft(index: number): AdminClientAireInput & {
  locationConfirmed: boolean;
} {
  return {
    name: `Aire ${index}`,
    address: "",
    city: "",
    lat: 0,
    lon: 0,
    schoolZone: "C",
    orderDays: [1, 2, 3, 4, 5],
    bisonFuteZone: 5,
    locationConfirmed: false,
  };
}
