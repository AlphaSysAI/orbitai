// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { computeAireSavings } from "@/features/regiaire/lib/aire-savings";
import type { ShiftClosureLite } from "@/features/regiaire/sector-manager/actions";
import { todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import { addDaysIso } from "@/features/regiaire/verdict/trends/iso-dates";
import { computeReplenishmentPlan } from "@/features/regiaire/verdict/replenishment/compute-plan";
import type { RegiaireContext } from "@/lib/regiaire/require-context";
import type { ServerSupabaseClient } from "@/server/auth/supabase-server";

export type GerantReplenishmentHint = {
  productName: string;
  suggestedOrderQty: number;
  orderByDate: string | null;
};

export type GerantAireCard = {
  aireId: string;
  name: string;
  city: string | null;
  savings: Awaited<ReturnType<typeof computeAireSavings>>;
  expiringCount: number;
  inProgressCount: number;
  todayClosures: ShiftClosureLite[];
  recentClosures: ShiftClosureLite[];
  replenishmentHints: GerantReplenishmentHint[];
};

export type GerantOverview = {
  organizationId: string;
  aires: GerantAireCard[];
  totals: {
    totalSavingsEur: number;
    expiringCount: number;
    inProgressCount: number;
    receptionHoursSaved: number;
    replenishmentSkuCount: number;
  };
};

async function buildGerantAireCard(
  db: SupabaseClient,
  supabase: ServerSupabaseClient,
  organizationId: string,
  userId: string,
  aire: { id: string; name: string; city: string | null },
  today: string,
  recentFrom: string
): Promise<GerantAireCard> {
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

  let replenishmentHints: GerantReplenishmentHint[] = [];
  try {
    const ctx: RegiaireContext = {
      userId,
      userEmail: undefined,
      organizationId,
      aireId: aire.id,
      supabase,
      db: db as RegiaireContext["db"],
    };

    const plan = await computeReplenishmentPlan(ctx, today);
    replenishmentHints = plan.lines
      .filter((line) => line.suggestedOrderQty > 0)
      .sort((a, b) => b.suggestedOrderQty - a.suggestedOrderQty)
      .slice(0, 3)
      .map((line) => ({
        productName: line.product.name,
        suggestedOrderQty: line.suggestedOrderQty,
        orderByDate: line.orderByDate,
      }));
  } catch {
    replenishmentHints = [];
  }

  return {
    aireId: aire.id,
    name: aire.name,
    city: aire.city,
    savings,
    expiringCount: expiringCount ?? 0,
    inProgressCount: inProgressCount ?? 0,
    todayClosures: allClosures.filter((c) => c.serviceDate === today),
    recentClosures: allClosures.slice(0, 6),
    replenishmentHints,
  };
}

export async function buildGerantOverview(
  db: SupabaseClient,
  supabase: ServerSupabaseClient,
  organizationId: string,
  userId: string,
  aireIds: string[]
): Promise<GerantOverview> {
  const today = todayParisIso();
  const recentFrom = addDaysIso(today, -7);

  if (aireIds.length === 0) {
    return {
      organizationId,
      aires: [],
      totals: {
        totalSavingsEur: 0,
        expiringCount: 0,
        inProgressCount: 0,
        receptionHoursSaved: 0,
        replenishmentSkuCount: 0,
      },
    };
  }

  const { data: aires } = await db
    .from("aires")
    .select("id, name, city")
    .eq("organization_id", organizationId)
    .in("id", aireIds)
    .order("name");

  const cards = await Promise.all(
    ((aires ?? []) as { id: string; name: string; city: string | null }[]).map(
      (aire) =>
        buildGerantAireCard(
          db,
          supabase,
          organizationId,
          userId,
          aire,
          today,
          recentFrom
        )
    )
  );

  const totals = cards.reduce(
    (acc, c) => ({
      totalSavingsEur: acc.totalSavingsEur + c.savings.totalSavingsEur,
      expiringCount: acc.expiringCount + c.expiringCount,
      inProgressCount: acc.inProgressCount + c.inProgressCount,
      receptionHoursSaved:
        acc.receptionHoursSaved + c.savings.receptionHoursSaved,
      replenishmentSkuCount:
        acc.replenishmentSkuCount + c.replenishmentHints.length,
    }),
    {
      totalSavingsEur: 0,
      expiringCount: 0,
      inProgressCount: 0,
      receptionHoursSaved: 0,
      replenishmentSkuCount: 0,
    }
  );

  return { organizationId, aires: cards, totals };
}
