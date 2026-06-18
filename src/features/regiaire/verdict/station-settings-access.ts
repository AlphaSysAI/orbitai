import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import {
  StationSettingsSchema,
  type SchoolZone,
  type StationSettings,
} from "@/features/regiaire/verdict/schemas";

export type AireRow = {
  id: string;
  organization_id: string;
  name: string;
  lat: number;
  lon: number;
  city: string | null;
  school_zone: string;
  order_days: number[];
};

function mapAireToSettings(row: AireRow): StationSettings {
  return StationSettingsSchema.parse({
    organizationId: row.organization_id,
    lat: Number(row.lat),
    lon: Number(row.lon),
    city: row.city ?? row.name,
    schoolZone: row.school_zone as SchoolZone,
    orderDays: row.order_days ?? [1, 2, 3, 4, 5],
  });
}

/** Paramètres de l'aire courante (remplace regiaire_station_settings). */
export async function getStationSettings(
  ctx: RegiaireContext
): Promise<StationSettings | null> {
  const { data, error } = await ctx.db
    .from("aires")
    .select(
      "id, organization_id, name, lat, lon, city, school_zone, order_days"
    )
    .eq("id", ctx.aireId)
    .maybeSingle();

  if (error || !data) return null;

  return mapAireToSettings(data as AireRow);
}

export async function requireStationSettings(
  ctx: RegiaireContext
): Promise<StationSettings> {
  const settings = await getStationSettings(ctx);
  if (!settings) {
    throw new Error(
      "Paramètres aire manquants — configurez lat/lon et zone scolaire."
    );
  }
  return settings;
}
