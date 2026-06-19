import "server-only";

import {
  BisonFuteSignalSchema,
  type BisonFuteLevel,
  type BisonFuteSignal,
} from "@/features/regiaire/verdict/bison-fute/schemas";
import { worstBisonFuteLevel } from "@/features/regiaire/verdict/bison-fute/parse-csv";
import { IsoDateSchema } from "@/features/regiaire/verdict/schemas";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

type ForecastDbRow = {
  direction: string;
  level: string;
};

export async function getBisonFuteForecast(
  ctx: RegiaireContext,
  signalDate: string
): Promise<BisonFuteSignal> {
  IsoDateSchema.parse(signalDate);

  const { data: aire, error: aireError } = await ctx.db
    .from("aires")
    .select("bison_fute_zone")
    .eq("id", ctx.aireId)
    .maybeSingle();

  if (aireError) {
    return unavailable(signalDate, aireError.message);
  }

  const zone = aire?.bison_fute_zone;
  if (zone == null || zone < 1 || zone > 6) {
    return unavailable(
      signalDate,
      "Zone Bison Futé non renseignée pour cette aire"
    );
  }

  const { data: rows, error } = await ctx.db
    .from("bison_fute_forecast")
    .select("direction, level")
    .eq("forecast_date", signalDate)
    .eq("zone", zone);

  if (error) {
    return unavailable(signalDate, error.message);
  }

  if (!rows || rows.length === 0) {
    return unavailable(signalDate, "Aucune prévision Bison Futé pour cette date");
  }

  const levelAller = levelForDirection(rows, "aller");
  const levelRetour = levelForDirection(rows, "retour");
  const level = worstBisonFuteLevel(levelAller, levelRetour);

  return BisonFuteSignalSchema.parse({
    available: true,
    signalDate,
    zone,
    level,
    levelAller,
    levelRetour,
    reason: null,
  });
}

function levelForDirection(
  rows: ForecastDbRow[],
  direction: "aller" | "retour"
): BisonFuteLevel {
  const row = rows.find((r) => r.direction === direction);
  if (!row) return "vert";
  const parsed = row.level as BisonFuteLevel;
  return parsed ?? "vert";
}

function unavailable(signalDate: string, reason: string): BisonFuteSignal {
  return BisonFuteSignalSchema.parse({
    available: false,
    signalDate,
    zone: null,
    level: null,
    levelAller: null,
    levelRetour: null,
    reason,
  });
}
