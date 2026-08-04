// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import pLimit from "p-limit";

import { requireRegiaireAccess } from "@/lib/organizations/access";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import { getMembershipRole } from "@/lib/regiaire/aire-scope";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import type { SecteurOverviewCacheRow } from "@/types/database.types";
import {
  buildSecteurOverview,
  type SecteurOverview,
} from "@/features/regiaire/sector-manager/actions";

/**
 * Fenêtre de fraîcheur du cache de résumé secteur. En deçà, on réutilise la
 * valeur en cache ; au-delà, on recalcule. Borne la charge DB à ~1 recalcul
 * par secteur par fenêtre, quel que soit le nombre de consultations.
 */
const OVERVIEW_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Concurrence maximale des recalculs de secteur (cache froid). Borne le fan-out
 * pour ne pas saturer le pool Postgres quand un grand nombre de chefs doivent
 * être recalculés simultanément (chaque recalcul est lui-même déjà borné côté
 * `buildSecteurOverview`).
 */
const CHEF_SUMMARY_CONCURRENCY = 10;

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
 *
 * Mis en cache par secteur + jour ([[secteur_overview_cache]]) avec une fenêtre
 * de fraîcheur de 10 min : sur cache chaud, le dashboard direction d'une grosse
 * enseigne passe de ~5 requêtes/aire (≈1500 pour 300 aires) à 1 lecture batch.
 * Le recalcul complet n'a lieu que pour les secteurs au cache absent ou périmé.
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

  const secteurIds = Array.from(secteurByChef.values()).map((s) => s.id);
  const today = todayParisIso();
  const freshThreshold = Date.now() - OVERVIEW_CACHE_TTL_MS;

  // Lecture batch du cache : 1 requête pour tous les secteurs concernés.
  const cacheBySecteur = new Map<string, SecteurOverviewCacheRow>();
  if (secteurIds.length > 0) {
    const { data: cacheRows } = await db
      .from("secteur_overview_cache")
      .select("*")
      .eq("run_date", today)
      .in("secteur_id", secteurIds);
    for (const row of (cacheRows ?? []) as SecteurOverviewCacheRow[]) {
      cacheBySecteur.set(row.secteur_id, row);
    }
  }

  const toUpsert: Array<Record<string, unknown>> = [];

  const limit = pLimit(CHEF_SUMMARY_CONCURRENCY);
  const summaries = await Promise.all(
    chefUserIds.map((chefId) => limit(async () => {
      const secteur = secteurByChef.get(chefId) ?? null;
      let aireCount = 0;
      let totalSavingsEur = 0;
      let expiringCount = 0;
      let inProgressCount = 0;

      if (secteur) {
        const cached = cacheBySecteur.get(secteur.id);
        const isFresh =
          cached && new Date(cached.computed_at).getTime() > freshThreshold;

        if (isFresh && cached) {
          aireCount = cached.aire_count;
          totalSavingsEur = Number(cached.total_savings_eur);
          expiringCount = cached.expiring_count;
          inProgressCount = cached.in_progress_count;
        } else {
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
          toUpsert.push({
            secteur_id: secteur.id,
            organization_id: organizationId,
            run_date: today,
            aire_count: aireCount,
            total_savings_eur: totalSavingsEur,
            expiring_count: expiringCount,
            in_progress_count: inProgressCount,
            reception_hours_saved: overview.totals.receptionHoursSaved,
            computed_at: new Date().toISOString(),
          });
        }
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
    }))
  );

  // Écriture batch du cache (best-effort : n'altère pas la réponse en cas d'échec).
  if (toUpsert.length > 0) {
    await db
      .from("secteur_overview_cache")
      .upsert(toUpsert, { onConflict: "secteur_id,run_date" });
  }

  return summaries;
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

    const role = await getMembershipRole(db, access.organizationId, user.id);
    if (
      role !== "directeur_region" &&
      role !== "direction_france" &&
      role !== "owner" &&
      role !== "admin"
    ) {
      return { success: false, error: "Accès réservé aux directeurs régionaux" };
    }

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
  } catch (error) {
    console.error("[getRegionOverview] échec de chargement:", error);
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
    const role = await getMembershipRole(db, access.organizationId, user.id);
    let allowed = role === "direction_france";

    if (!allowed) {
      const { data: link } = await db
        .from("org_hierarchy_links")
        .select("subordinate_user_id")
        .eq("organization_id", access.organizationId)
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
  } catch (error) {
    console.error("[getChefSecteurDetail] échec de chargement:", error);
    return { success: false, error: "Erreur de chargement" };
  }
}
