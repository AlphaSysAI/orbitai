"use server";

import {
  SchoolZoneSchema,
  StationSettingsSchema,
  type StationSettings,
} from "@/features/regiaire/verdict/schemas";
import { getStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";
import {
  OrgContextError,
  requireOrgAdminContext,
} from "@/lib/organizations/org-context";

export type GetStationSettingsActionResult =
  | { success: true; data: StationSettings | null }
  | { success: false; error: string; code?: string };

export type UpsertStationSettingsActionResult =
  | { success: true; data: StationSettings }
  | { success: false; error: string; code?: string };

export async function getStationSettingsAction(
  aireId: string
): Promise<GetStationSettingsActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const settings = await getStationSettings(ctx);
    return { success: true, data: settings };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors du chargement" };
  }
}

export async function upsertStationSettings(
  aireId: string,
  input: {
  lat: number;
  lon: number;
  city?: string;
  schoolZone: string;
  orderDays: number[];
}
): Promise<UpsertStationSettingsActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    await requireOrgAdminContext();

    const schoolZone = SchoolZoneSchema.parse(input.schoolZone);
    const orderDays = input.orderDays.filter((d) => d >= 1 && d <= 7);
    if (orderDays.length === 0) {
      return { success: false, error: "Au moins un jour de commande requis." };
    }

    const city = input.city?.trim() || null;

    const { data, error } = await ctx.db
      .from("aires")
      .update({
        lat: input.lat,
        lon: input.lon,
        city,
        name: city ?? "Aire principale",
        school_zone: schoolZone,
        order_days: orderDays,
      })
      .eq("id", ctx.aireId)
      .eq("organization_id", ctx.organizationId)
      .select(
        "organization_id, lat, lon, city, school_zone, order_days, name"
      )
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Enregistrement impossible" };
    }

    const settings = StationSettingsSchema.parse({
      organizationId: data.organization_id,
      lat: Number(data.lat),
      lon: Number(data.lon),
      city: data.city ?? data.name,
      schoolZone: data.school_zone,
      orderDays: data.order_days ?? orderDays,
    });

    return { success: true, data: settings };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}
