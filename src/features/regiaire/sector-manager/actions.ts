// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireRegiaireAccess } from "@/lib/organizations/access";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import { addDaysIso } from "@/features/regiaire/verdict/trends/iso-dates";
import { computeAireSavings, type AireSavings } from "@/features/regiaire/lib/aire-savings";

// ─── Types ─────────────────────────────────────────────────────────────────

export type ShiftClosureLite = {
  shift: string;
  serviceDate: string;
  completionPct: number;
  checkedTasks: number;
  totalTasks: number;
  closedAt: string;
};

export type SecteurAireCard = {
  aireId: string;
  name: string;
  city: string | null;
  savings: AireSavings;
  expiringCount: number;
  inProgressCount: number;
  todayClosures: ShiftClosureLite[];
  recentClosures: ShiftClosureLite[];
};

export type SecteurOverview = {
  secteurId: string;
  secteurName: string;
  organizationId: string;
  aires: SecteurAireCard[];
  totals: {
    totalSavingsEur: number;
    expiringCount: number;
    inProgressCount: number;
    receptionHoursSaved: number;
  };
};

// ─── Core : construit l'overview d'un secteur (réutilisé par chef/région/direction) ─

export async function buildSecteurOverview(
  db: SupabaseClient,
  organizationId: string,
  secteurId: string,
  secteurName: string
): Promise<SecteurOverview> {
  const today = todayParisIso();
  const recentFrom = addDaysIso(today, -7);

  const { data: aires } = await db
    .from("aires")
    .select("id, name, city")
    .eq("secteur_id", secteurId)
    .eq("organization_id", organizationId)
    .order("name");

  const aireList = (aires ?? []) as { id: string; name: string; city: string | null }[];

  const cards: SecteurAireCard[] = await Promise.all(
    aireList.map(async (aire) => {
      const [savings, { count: expiringCount }, { count: inProgressCount }, { data: closures }] =
        await Promise.all([
          computeAireSavings(db, aire.id, today),
          db
            .from("stock_batches")
            .select("id", { count: "exact", head: true })
            .eq("aire_id", aire.id)
            .not("dlc", "is", null)
            .lte("dlc", addDaysIso(today, 3))
            .gt("quantity", 0),
          db
            .from("deliveries")
            .select("id", { count: "exact", head: true })
            .eq("aire_id", aire.id)
            .in("status", ["pending", "in_progress"]),
          db
            .from("shift_closures")
            .select("shift, service_date, completion_pct, checked_tasks, total_tasks, closed_at")
            .eq("aire_id", aire.id)
            .gte("service_date", recentFrom)
            .order("service_date", { ascending: false })
            .order("closed_at", { ascending: false }),
        ]);

      const allClosures: ShiftClosureLite[] = (closures ?? []).map((c) => ({
        shift: c.shift as string,
        serviceDate: String(c.service_date),
        completionPct: Number(c.completion_pct),
        checkedTasks: Number(c.checked_tasks),
        totalTasks: Number(c.total_tasks),
        closedAt: String(c.closed_at),
      }));

      return {
        aireId: aire.id,
        name: aire.name,
        city: aire.city,
        savings,
        expiringCount: expiringCount ?? 0,
        inProgressCount: inProgressCount ?? 0,
        todayClosures: allClosures.filter((c) => c.serviceDate === today),
        recentClosures: allClosures.slice(0, 6),
      };
    })
  );

  const totals = cards.reduce(
    (acc, c) => ({
      totalSavingsEur: acc.totalSavingsEur + c.savings.totalSavingsEur,
      expiringCount: acc.expiringCount + c.expiringCount,
      inProgressCount: acc.inProgressCount + c.inProgressCount,
      receptionHoursSaved: acc.receptionHoursSaved + c.savings.receptionHoursSaved,
    }),
    { totalSavingsEur: 0, expiringCount: 0, inProgressCount: 0, receptionHoursSaved: 0 }
  );

  return { secteurId, secteurName, organizationId, aires: cards, totals };
}

// ─── Chef de secteur : son propre overview ─────────────────────────────────

export type GetSecteurOverviewResult =
  | { success: true; data: SecteurOverview | null }
  | { success: false; error: string };

export async function getSecteurOverview(): Promise<GetSecteurOverviewResult> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) return { success: false, error: "Module non activé" };

    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: "Non authentifié" };

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    const { data: secteur } = await db
      .from("secteurs")
      .select("id, name")
      .eq("chef_user_id", user.id)
      .eq("organization_id", access.organizationId)
      .maybeSingle();

    if (!secteur) return { success: true, data: null };

    const overview = await buildSecteurOverview(
      db,
      access.organizationId,
      secteur.id as string,
      secteur.name as string
    );
    return { success: true, data: overview };
  } catch {
    return { success: false, error: "Erreur de chargement" };
  }
}

/** IDs des aires explicitement attribuées au gérant connecté. */
export async function getGerantAireIds(): Promise<string[]> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) return [];

    const user = await getAuthenticatedUser();
    if (!user) return [];

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    const { data } = await db
      .from("gerant_aires")
      .select("aire_id")
      .eq("gerant_user_id", user.id)
      .eq("organization_id", access.organizationId);

    return (data ?? []).map((r) => r.aire_id as string);
  } catch {
    return [];
  }
}

export async function getCurrentUserOrgRole(): Promise<string | null> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) return null;

    const user = await getAuthenticatedUser();
    if (!user) return null;

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    const { data } = await db
      .from("organization_members")
      .select("role")
      .eq("organization_id", access.organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    return (data?.role as string | null) ?? null;
  } catch {
    return null;
  }
}
