// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import {
  resolveRegiaireCapabilities,
  type RegiaireCapabilities,
} from "@/lib/regiaire/regiaire-capabilities";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type GetRegiaireCapabilitiesResult =
  | { success: true; data: RegiaireCapabilities }
  | { success: false; error: string; code?: string };

export async function getRegiaireCapabilities(
  aireId: string
): Promise<GetRegiaireCapabilitiesResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const data = await resolveRegiaireCapabilities(ctx);
    return { success: true, data };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur serveur" };
  }
}
