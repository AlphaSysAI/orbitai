"use server";

import { daysBetweenIso, todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import {
  EXPIRY_RECOVERY_RATE,
  RECEPTION_MINUTES_SAVED,
  STOCK_SHRINKAGE_RATE,
  unitValueForCategory,
} from "@/features/regiaire/lib/business-stats";
import { requireRegiaireAccess } from "@/lib/organizations/access";
import { forWrite } from "@/lib/supabase-write";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";

export type RegiaireBusinessDashboardStats = {
  aireCount: number;
  completedReceptions: number;
  receptionHoursSaved: number;
  expirySavingsEur: number;
  stockSavingsEur: number;
  totalSavingsEur: number;
};

export type GetRegiaireBusinessDashboardStatsResult =
  | { success: true; data: RegiaireBusinessDashboardStats }
  | { success: false; error: string; code?: string };

type StockBatchRow = {
  quantity: number;
  dlc: string | null;
  products: { category: string | null } | { category: string | null }[] | null;
};

function productCategory(
  products: StockBatchRow["products"]
): string | null {
  if (!products) return null;
  if (Array.isArray(products)) {
    return products[0]?.category ?? null;
  }
  return products.category;
}

/**
 * KPIs agrégés org (toutes les aires) pour le dashboard RégiAire.
 */
export async function getRegiaireBusinessDashboardStats(): Promise<GetRegiaireBusinessDashboardStatsResult> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) {
      return {
        success: false,
        error: "Module RégiAire non activé",
        code: access.reason,
      };
    }

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);
    const orgId = access.organizationId;
    const today = todayParisIso();

    const [
      { count: aireCount, error: aireError },
      { count: receptionCount, error: receptionError },
      { data: batches, error: batchError },
    ] = await Promise.all([
      db
        .from("aires")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      db
        .from("deliveries")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("status", ["completed", "discrepancy"])
        .not("completed_at", "is", null),
      db
        .from("stock_batches")
        .select("quantity, dlc, products(category)")
        .eq("organization_id", orgId)
        .gt("quantity", 0),
    ]);

    if (aireError) return { success: false, error: aireError.message };
    if (receptionError) return { success: false, error: receptionError.message };
    if (batchError) return { success: false, error: batchError.message };

    let expirySavingsEur = 0;
    let stockSavingsEur = 0;

    for (const row of (batches ?? []) as StockBatchRow[]) {
      const qty = Number(row.quantity);
      if (qty <= 0) continue;

      const unitValue = unitValueForCategory(productCategory(row.products));
      const lineValue = qty * unitValue;

      if (!row.dlc) continue;

      const daysLeft = daysBetweenIso(today, String(row.dlc));

      if (daysLeft >= 1 && daysLeft <= 3) {
        expirySavingsEur += lineValue * EXPIRY_RECOVERY_RATE;
      } else if (daysLeft > 3) {
        stockSavingsEur += lineValue * STOCK_SHRINKAGE_RATE;
      }
    }

    expirySavingsEur = Math.round(expirySavingsEur);
    stockSavingsEur = Math.round(stockSavingsEur);

    const completedReceptions = receptionCount ?? 0;
    const receptionHoursSaved =
      Math.round(((completedReceptions * RECEPTION_MINUTES_SAVED) / 60) * 10) / 10;

    return {
      success: true,
      data: {
        aireCount: aireCount ?? 0,
        completedReceptions,
        receptionHoursSaved,
        expirySavingsEur,
        stockSavingsEur,
        totalSavingsEur: expirySavingsEur + stockSavingsEur,
      },
    };
  } catch {
    return { success: false, error: "Erreur lors du chargement des indicateurs" };
  }
}
