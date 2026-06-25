// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import {
  loadRegiaireHeaderSnapshot,
  type RegiaireHeaderSnapshot,
} from "@/features/regiaire/lib/header-snapshot";
import {
  RegiaireContextError,
} from "@/lib/regiaire/require-context";

export type GetRegiaireHeaderInfoResult =
  | { success: true; data: RegiaireHeaderSnapshot }
  | { success: false; error: string; code?: string };

export async function getRegiaireHeaderInfo(
  aireId: string
): Promise<GetRegiaireHeaderInfoResult> {
  try {
    const data = await loadRegiaireHeaderSnapshot(aireId);
    return { success: true, data };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Impossible de charger le contexte station" };
  }
}
