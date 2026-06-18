import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import {
  StationSettingsSchema,
  type SchoolZone,
  type StationSettings,
} from "@/features/regiaire/verdict/schemas";

export type StationSettingsRow = {
  organization_id: string;
  lat: number;
  lon: number;
  city: string | null;
  school_zone: string;
  order_days: number[];
};

export async function getStationSettings(
  ctx: RegiaireContext
): Promise<StationSettings | null> {
  const { data, error } = await ctx.db
    .from("regiaire_station_settings")
    .select("organization_id, lat, lon, city, school_zone, order_days")
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as StationSettingsRow;

  return StationSettingsSchema.parse({
    organizationId: row.organization_id,
    lat: Number(row.lat),
    lon: Number(row.lon),
    city: row.city,
    schoolZone: row.school_zone as SchoolZone,
    orderDays: row.order_days ?? [1, 2, 3, 4, 5],
  });
}

export async function requireStationSettings(
  ctx: RegiaireContext
): Promise<StationSettings> {
  const settings = await getStationSettings(ctx);
  if (!settings) {
    throw new Error(
      "Paramètres station manquants — configurez lat/lon et zone scolaire."
    );
  }
  return settings;
}
