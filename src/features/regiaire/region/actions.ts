// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireRegiaireAccess } from "@/lib/organizations/access";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import {
  buildSecteurOverview,
  type SecteurOverview,
} from "@/features/regiaire/sector-manager/actions";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ChefSummary = {
  chefUserId: string;
  chefName: string;
  secteurId: string | null;
  secteurName: string | null;
  aireCount: number;
  totalSavingsEur: number;
  expiringCount: number;
  inProgressCount: number;
};

export type RegionOverview = {
  chefs: ChefSummary[];
  totals: {
    chefCount: number;
    aireCount: number;
    totalSavingsEur: number;
    expiringCount: number;
  };
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function profileNameMap(
  db: SupabaseClient,
  organizationId: string
): Promise<Map<string, string>> {
  const { data } = await db
    .from("org_member_profiles")
    .select("user_id, first_name, last_name")
    .eq("organization_id", organizationId);
  const map = new Map<string, string>();
  for (const p of data ?? []) {
    map.set(p.user_id as string, `${p.first_name} ${p.last_name}`);
  }
  return map;
}

async function subordinateIds(
  db: SupabaseClient,
  managerUserId: string
): Promise<string[]> {
  const { data } = await db
    .from("org_hierarchy_links")
    .select("subordinate_user_id")
    .eq("manager_user_id", managerUserId);
  return (data ?? []).map((l) => l.subordinate_user_id as string);
}

/**
 * Construit les fiches synthétiques des chefs de secteur fournis.
 * Réutilisé par le dashboard région ET direction France.
 */
export async function buildChefSummaries(
  db: SupabaseClient,
  organizationId: string,
  chefUserIds: string[]
): Promise<ChefSummary[]> {
  if (chefUserIds.length === 0) return [];

  const [names, { data: secteurs }] = await Promise.all([
    profileNameMap(db, organizationId),
    db
      .from("secteurs")
      .select("id, name, chef_user_id")
      .eq("organization_id", organizationId)
      .in("chef_user_id", chefUserIds),
  ]);

  const secteurByChef = new Map<string, { id: string; name: string }>();
  for (const s of secteurs ?? []) {
    secteurByChef.set(s.chef_user_id as string, {
      id: s.id as string,
      name: s.name as string,
    });
  }

  return Promise.all(
    chefUserIds.map(async (chefId) => {
      const secteur = secteurByChef.get(chefId) ?? null;
      let aireCount = 0;
      let totalSavingsEur = 0;
      let expiringCount = 0;
      let inProgressCount = 0;

      if (secteur) {
        const overview = await buildSecteurOverview(
          db,
          organizationId,
          secteur.id,
          secteur.name
        );
        aireCount = overview.aires.length;
        totalSavingsEur = overview.totals.totalSavingsEur;
        expiringCount = overview.totals.expiringCount;
        inProgressCount = overview.totals.inProgressCount;
      }

      return {
        chefUserId: chefId,
        chefName: names.get(chefId) ?? chefId.slice(0, 8),
        secteurId: secteur?.id ?? null,
        secteurName: secteur?.name ?? null,
        aireCount,
        totalSavingsEur,
        expiringCount,
        inProgressCount,
      };
    })
  );
}

// ─── Dashboard directeur régional ────────────────────────────────────────────

export type GetRegionOverviewResult =
  | { success: true; data: RegionOverview }
  | { success: false; error: string };

export async function getRegionOverview(): Promise<GetRegionOverviewResult> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) return { success: false, error: "Module non activé" };

    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    const chefIds = await subordinateIds(db, user.id);
    const chefs = await buildChefSummaries(db, access.organizationId, chefIds);

    const totals = chefs.reduce(
      (acc, c) => ({
        chefCount: acc.chefCount + 1,
        aireCount: acc.aireCount + c.aireCount,
        totalSavingsEur: acc.totalSavingsEur + c.totalSavingsEur,
        expiringCount: acc.expiringCount + c.expiringCount,
      }),
      { chefCount: 0, aireCount: 0, totalSavingsEur: 0, expiringCount: 0 }
    );

    return { success: true, data: { chefs, totals } };
  } catch {
    return { success: false, error: "Erreur de chargement" };
  }
}

// ─── Drill-down : détail d'un chef de secteur ────────────────────────────────

export type GetChefDetailResult =
  | { success: true; data: { chefName: string; overview: SecteurOverview } }
  | { success: false; error: string };

/**
 * Détail complet du secteur d'un chef, accessible par son supérieur
 * (directeur régional rattaché) ou la direction France de l'org.
 */
export async function getChefSecteurDetail(
  chefUserId: string
): Promise<GetChefDetailResult> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) return { success: false, error: "Module non activé" };

    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    // Garde-fou : l'appelant doit superviser ce chef OU être direction France.
    const { data: membership } = await db
      .from("organization_members")
      .select("role")
      .eq("organization_id", access.organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    const role = (membership?.role as string | null) ?? null;
    let allowed = role === "direction_france";

    if (!allowed) {
      const { data: link } = await db
        .from("org_hierarchy_links")
        .select("subordinate_user_id")
        .eq("manager_user_id", user.id)
        .eq("subordinate_user_id", chefUserId)
        .maybeSingle();
      allowed = Boolean(link);
    }

    if (!allowed) {
      return { success: false, error: "Accès non autorisé à ce chef de secteur" };
    }

    const { data: secteur } = await db
      .from("secteurs")
      .select("id, name")
      .eq("chef_user_id", chefUserId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();

    if (!secteur) {
      return { success: false, error: "Ce chef n'a pas de secteur attribué" };
    }

    const names = await profileNameMap(db, access.organizationId);
    const overview = await buildSecteurOverview(
      db,
      access.organizationId,
      secteur.id as string,
      secteur.name as string
    );

    return {
      success: true,
      data: {
        chefName: names.get(chefUserId) ?? chefUserId.slice(0, 8),
        overview,
      },
    };
  } catch {
    return { success: false, error: "Erreur de chargement" };
  }
}
