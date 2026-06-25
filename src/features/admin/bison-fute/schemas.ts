// Copyright © 2026 OrbitSys. Tous droits réservés.

import { z } from "zod";

import {
  BisonFuteDirectionSchema,
  BisonFuteForecastRowSchema,
  BisonFuteLevelSchema,
  type BisonFuteDirection,
  type BisonFuteForecastRow,
  type BisonFuteLevel,
  type BisonFuteZone,
} from "@/features/regiaire/verdict/bison-fute/schemas";
import {
  expandBisonFuteDirection,
} from "@/features/regiaire/verdict/bison-fute/parse-csv";
import { IsoDateSchema } from "@/features/regiaire/verdict/schemas";

const ZoneOverridesSchema = z
  .object({
    1: BisonFuteLevelSchema.optional(),
    2: BisonFuteLevelSchema.optional(),
    3: BisonFuteLevelSchema.optional(),
    4: BisonFuteLevelSchema.optional(),
    5: BisonFuteLevelSchema.optional(),
    6: BisonFuteLevelSchema.optional(),
  })
  .partial();

export const DirectionQuickInputSchema = z.object({
  mode: z.literal("quick"),
  nationalLevel: BisonFuteLevelSchema,
  zoneOverrides: ZoneOverridesSchema.optional(),
});

export const DirectionCodeInputSchema = z.object({
  mode: z.literal("code"),
  encoding: z.string().max(40),
});

export const DirectionInputSchema = z.discriminatedUnion("mode", [
  DirectionQuickInputSchema,
  DirectionCodeInputSchema,
]);

export type DirectionInput = z.infer<typeof DirectionInputSchema>;

export const UpsertBisonFuteDaySchema = z.object({
  date: IsoDateSchema,
  aller: DirectionInputSchema,
  retour: DirectionInputSchema,
});

export type UpsertBisonFuteDayInput = z.infer<typeof UpsertBisonFuteDaySchema>;

export const BulkImportBisonFuteSchema = z.object({
  text: z.string().min(1).max(500_000),
});

export const ListBisonFuteYearSchema = z.object({
  year: z.number().int().min(2000).max(2100),
});

export const BisonFuteDayKeySchema = z.object({
  date: IsoDateSchema,
});

export type BisonFuteDaySummary = {
  date: string;
  aller: Record<BisonFuteZone, BisonFuteLevel>;
  retour: Record<BisonFuteZone, BisonFuteLevel>;
};

export function directionInputToRows(
  date: string,
  direction: BisonFuteDirection,
  input: DirectionInput
): BisonFuteForecastRow[] {
  if (input.mode === "code") {
    return expandBisonFuteDirection(date, direction, input.encoding);
  }

  const rows: BisonFuteForecastRow[] = [];
  const overrides = input.zoneOverrides ?? {};

  for (let zone = 1; zone <= 6; zone++) {
    const z = zone as BisonFuteZone;
    const level =
      overrides[z] ?? input.nationalLevel;
    rows.push(
      BisonFuteForecastRowSchema.parse({
        date,
        zone: z,
        direction,
        level,
      })
    );
  }

  return rows;
}

export function upsertDayInputToRows(
  input: UpsertBisonFuteDayInput
): BisonFuteForecastRow[] {
  const parsed = UpsertBisonFuteDaySchema.parse(input);
  return [
    ...directionInputToRows(parsed.date, BisonFuteDirectionSchema.parse("aller"), parsed.aller),
    ...directionInputToRows(parsed.date, BisonFuteDirectionSchema.parse("retour"), parsed.retour),
  ];
}

export function rowsToDaySummary(
  date: string,
  rows: BisonFuteForecastRow[]
): BisonFuteDaySummary {
  const aller = {} as Record<BisonFuteZone, BisonFuteLevel>;
  const retour = {} as Record<BisonFuteZone, BisonFuteLevel>;

  for (let z = 1; z <= 6; z++) {
    const zone = z as BisonFuteZone;
    aller[zone] =
      rows.find((r) => r.date === date && r.zone === zone && r.direction === "aller")
        ?.level ?? "vert";
    retour[zone] =
      rows.find((r) => r.date === date && r.zone === zone && r.direction === "retour")
        ?.level ?? "vert";
  }

  return { date, aller, retour };
}

export function daySummaryToEditorDefaults(
  summary: BisonFuteDaySummary
): UpsertBisonFuteDayInput {
  return {
    date: summary.date,
    aller: levelsToQuickInput(summary.aller),
    retour: levelsToQuickInput(summary.retour),
  };
}

function levelsToQuickInput(
  levels: Record<BisonFuteZone, BisonFuteLevel>
): DirectionInput {
  const zones = [1, 2, 3, 4, 5, 6] as const;
  const nationalLevel = levels[zones[0]];
  const zoneOverrides: Partial<Record<BisonFuteZone, BisonFuteLevel>> = {};
  let hasOverride = false;

  for (const z of zones) {
    if (levels[z] !== nationalLevel) {
      zoneOverrides[z] = levels[z];
      hasOverride = true;
    }
  }

  return {
    mode: "quick",
    nationalLevel,
    zoneOverrides: hasOverride ? zoneOverrides : undefined,
  };
}
