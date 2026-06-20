"use server";

import { type StationSettings } from "@/features/regiaire/verdict/schemas";
import { getStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

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
  _aireId: string,
  _input: {
    lat: number;
    lon: number;
    city?: string;
    schoolZone: string;
    orderDays: number[];
  }
): Promise<UpsertStationSettingsActionResult> {
  return {
    success: false,
    error:
      "La configuration des aires est gérée par OrbitAI. Contactez votre administrateur.",
    code: "forbidden",
  };
}
