import "server-only";

import {
  IsoDateSchema,
  TrafficSignalSchema,
  type TrafficSignal,
} from "@/features/regiaire/verdict/schemas";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

export async function getTrafficForDate(
  ctx: RegiaireContext,
  signalDate: string
): Promise<TrafficSignal> {
  IsoDateSchema.parse(signalDate);

  const { data, error } = await ctx.db
    .from("traffic_signals")
    .select("footfall_index")
    .eq("organization_id", ctx.organizationId)
    .eq("aire_id", ctx.aireId)
    .eq("signal_date", signalDate)
    .maybeSingle();

  if (error) {
    return TrafficSignalSchema.parse({
      available: false,
      signalDate,
      reason: error.message,
    });
  }

  if (!data) {
    return TrafficSignalSchema.parse({
      available: false,
      signalDate,
      reason: "Aucun signal trafic pour cette date",
    });
  }

  return TrafficSignalSchema.parse({
    available: true,
    signalDate,
    footfallIndex: Number(data.footfall_index),
  });
}
