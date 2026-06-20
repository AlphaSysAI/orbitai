import { z } from "zod";

import { IsoDateSchema } from "@/features/regiaire/verdict/shared-schemas";

export const BISON_FUTE_ZONES = [1, 2, 3, 4, 5, 6] as const;
export type BisonFuteZone = (typeof BISON_FUTE_ZONES)[number];

export const BisonFuteZoneSchema = z.number().int().min(1).max(6);

export const BisonFuteLevelSchema = z.enum([
  "vert",
  "orange",
  "rouge",
  "noir",
]);
export type BisonFuteLevel = z.infer<typeof BisonFuteLevelSchema>;

export const BisonFuteDirectionSchema = z.enum(["aller", "retour"]);
export type BisonFuteDirection = z.infer<typeof BisonFuteDirectionSchema>;

export const BisonFuteForecastRowSchema = z.object({
  date: IsoDateSchema,
  zone: BisonFuteZoneSchema,
  direction: BisonFuteDirectionSchema,
  level: BisonFuteLevelSchema,
});

export type BisonFuteForecastRow = z.infer<typeof BisonFuteForecastRowSchema>;

export const BisonFuteSignalSchema = z.object({
  available: z.boolean(),
  signalDate: IsoDateSchema,
  zone: BisonFuteZoneSchema.nullable(),
  level: BisonFuteLevelSchema.nullable(),
  levelAller: BisonFuteLevelSchema.nullable(),
  levelRetour: BisonFuteLevelSchema.nullable(),
  reason: z.string().nullable(),
});

export type BisonFuteSignal = z.infer<typeof BisonFuteSignalSchema>;

export const BISON_FUTE_ZONE_LABELS: Record<BisonFuteZone, string> = {
  1: "Île-de-France",
  2: "Grand Ouest / Nord",
  3: "Bourgogne / Est",
  4: "Rhône-Alpes / Auvergne",
  5: "Sud-Ouest",
  6: "Arc méditerranéen",
};

export const BISON_FUTE_LEVEL_LABELS: Record<BisonFuteLevel, string> = {
  vert: "Vert",
  orange: "Orange",
  rouge: "Rouge",
  noir: "Noir",
};

export const BISON_FUTE_LEVEL_PRIORITY: Record<BisonFuteLevel, number> = {
  vert: 0,
  orange: 1,
  rouge: 2,
  noir: 3,
};
