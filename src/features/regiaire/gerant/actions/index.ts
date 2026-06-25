// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { buildGerantOverview, type GerantOverview } from "@/features/regiaire/gerant/actions/overview";
import { getGerantAireIds } from "@/features/regiaire/sector-manager/actions";
import { requireRegiaireAccess } from "@/lib/organizations/access";
import { forWrite } from "@/lib/supabase-write";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";

export type GetGerantOverviewResult =
  | { success: true; data: GerantOverview }
  | { success: false; error: string };

export async function getGerantOverview(): Promise<GetGerantOverviewResult> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) {
      return { success: false, error: "Module non activé" };
    }

    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const aireIds = await getGerantAireIds();
    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    const data = await buildGerantOverview(
      db,
      supabase,
      access.organizationId,
      user.id,
      aireIds
    );

    return { success: true, data };
  } catch {
    return { success: false, error: "Erreur de chargement" };
  }
}
