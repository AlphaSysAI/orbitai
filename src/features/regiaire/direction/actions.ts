// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireRegiaireAccess } from "@/lib/organizations/access";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import {
  buildChefSummaries,
  type ChefSummary,
} from "@/features/regiaire/region/actions";

export type RegionalGroup = {
  regionalUserId: string;
  regionalName: string;
  chefs: ChefSummary[];
  totalSavingsEur: number;
  aireCount: number;
  expiringCount: number;
};

export type DirectionOverview = {
  regionals: RegionalGroup[];
  unassignedChefs: ChefSummary[];
  totals: {
    regionalCount: number;
    chefCount: number;
    aireCount: number;
    totalSavingsEur: number;
    expiringCount: number;
  };
};

export type GetDirectionOverviewResult =
  | { success: true; data: DirectionOverview }
  | { success: false; error: string };

export async function getDirectionOverview(): Promise<GetDirectionOverviewResult> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) return { success: false, error: "Module non activé" };

    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);
    const orgId = access.organizationId;

    const [{ data: members }, { data: profiles }, { data: links }] =
      await Promise.all([
        db
          .from("organization_members")
          .select("user_id, role")
          .eq("organization_id", orgId)
          .in("role", ["directeur_region", "chef_secteur"]),
        db
          .from("org_member_profiles")
          .select("user_id, first_name, last_name")
          .eq("organization_id", orgId),
        db
          .from("org_hierarchy_links")
          .select("manager_user_id, subordinate_user_id")
          .eq("organization_id", orgId),
      ]);

    const nameOf = (id: string) => {
      const p = (profiles ?? []).find((x) => x.user_id === id);
      return p ? `${p.first_name} ${p.last_name}` : id.slice(0, 8);
    };

    const regionalIds = (members ?? [])
      .filter((m) => m.role === "directeur_region")
      .map((m) => m.user_id as string);
    const allChefIds = (members ?? [])
      .filter((m) => m.role === "chef_secteur")
      .map((m) => m.user_id as string);

    // Chefs rattachés à un régional
    const chefsByRegional = new Map<string, string[]>();
    const assignedChefIds = new Set<string>();
    for (const link of links ?? []) {
      const mgr = link.manager_user_id as string;
      const sub = link.subordinate_user_id as string;
      if (regionalIds.includes(mgr) && allChefIds.includes(sub)) {
        if (!chefsByRegional.has(mgr)) chefsByRegional.set(mgr, []);
        chefsByRegional.get(mgr)!.push(sub);
        assignedChefIds.add(sub);
      }
    }

    const regionals: RegionalGroup[] = await Promise.all(
      regionalIds.map(async (rid) => {
        const chefIds = chefsByRegional.get(rid) ?? [];
        const chefs = await buildChefSummaries(db, orgId, chefIds);
        return {
          regionalUserId: rid,
          regionalName: nameOf(rid),
          chefs,
          totalSavingsEur: chefs.reduce((s, c) => s + c.totalSavingsEur, 0),
          aireCount: chefs.reduce((s, c) => s + c.aireCount, 0),
          expiringCount: chefs.reduce((s, c) => s + c.expiringCount, 0),
        };
      })
    );

    const unassignedIds = allChefIds.filter((id) => !assignedChefIds.has(id));
    const unassignedChefs = await buildChefSummaries(db, orgId, unassignedIds);

    const allGroups = [
      ...regionals.flatMap((r) => r.chefs),
      ...unassignedChefs,
    ];
    const totals = {
      regionalCount: regionals.length,
      chefCount: allChefIds.length,
      aireCount: allGroups.reduce((s, c) => s + c.aireCount, 0),
      totalSavingsEur: allGroups.reduce((s, c) => s + c.totalSavingsEur, 0),
      expiringCount: allGroups.reduce((s, c) => s + c.expiringCount, 0),
    };

    return {
      success: true,
      data: { regionals, unassignedChefs, totals },
    };
  } catch {
    return { success: false, error: "Erreur de chargement" };
  }
}
