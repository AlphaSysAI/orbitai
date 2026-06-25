// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { daysBetweenIso, todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import {
  EXPIRY_RECOVERY_RATE,
  RECEPTION_MINUTES_SAVED,
  STOCK_SHRINKAGE_RATE,
  unitValueForCategory,
} from "@/features/regiaire/lib/business-stats";
import {
  getMembershipRole,
  listAccessibleAireIds,
} from "@/lib/regiaire/aire-scope";
import { requireRegiaireAccess } from "@/lib/organizations/access";
import { forWrite } from "@/lib/supabase-write";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";

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
  aire_id: string;
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
 * KPIs agrégés sur le périmètre d'aires accessible à l'utilisateur.
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

    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "Non authentifié", code: "unauthenticated" };
    }

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);
    const orgId = access.organizationId;
    const today = todayParisIso();

    const role =
      (await getMembershipRole(db, orgId, user.id)) ?? "member";
    const accessible = await listAccessibleAireIds(
      db,
      orgId,
      user.id,
      role
    );

    let aireFilter: string[] | null = null;
    if (accessible !== "all") {
      if (accessible.length === 0) {
        return {
          success: true,
          data: {
            aireCount: 0,
            completedReceptions: 0,
            receptionHoursSaved: 0,
            expirySavingsEur: 0,
            stockSavingsEur: 0,
            totalSavingsEur: 0,
          },
        };
      }
      aireFilter = accessible;
    }

    const aireCountQuery = db
      .from("aires")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);
    const receptionQuery = db
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["completed", "discrepancy"])
      .not("completed_at", "is", null);
    const batchQuery = db
      .from("stock_batches")
      .select("quantity, dlc, aire_id, products(category)")
      .eq("organization_id", orgId)
      .gt("quantity", 0);

    if (aireFilter) {
      aireCountQuery.in("id", aireFilter);
      receptionQuery.in("aire_id", aireFilter);
      batchQuery.in("aire_id", aireFilter);
    }

    const [
      { count: aireCount, error: aireError },
      { count: receptionCount, error: receptionError },
      { data: batches, error: batchError },
    ] = await Promise.all([aireCountQuery, receptionQuery, batchQuery]);

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
