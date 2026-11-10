// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { daysBetweenIso } from "@/features/regiaire/verdict/lib/dates";
import {
  EXPIRY_RECOVERY_RATE,
  RECEPTION_MINUTES_SAVED,
  STOCK_SHRINKAGE_RATE,
  unitValueForCategory,
} from "@/features/regiaire/lib/business-stats";

export type AireSavings = {
  expirySavingsEur: number;
  stockSavingsEur: number;
  totalSavingsEur: number;
  completedReceptions: number;
  receptionHoursSaved: number;
};

type StockBatchRow = {
  quantity: number;
  dlc: string | null;
  products: { category: string | null } | { category: string | null }[] | null;
};

function productCategory(products: StockBatchRow["products"]): string | null {
  if (!products) return null;
  if (Array.isArray(products)) return products[0]?.category ?? null;
  return products.category;
}

/**
 * Économies réalisées pour UNE aire (même modèle que le dashboard org agrégé,
 * cf. get-business-dashboard-stats.ts). Utilise le client en session/service.
 */
export async function computeAireSavings(
  db: SupabaseClient,
  aireId: string,
  today: string
): Promise<AireSavings> {
  const [{ count: receptionCount }, { data: batches }] = await Promise.all([
    db
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("aire_id", aireId)
      .in("status", ["completed", "discrepancy"])
      .not("completed_at", "is", null),
    db
      .from("stock_batches")
      .select("quantity, dlc, products(category)")
      .eq("aire_id", aireId)
      .gt("quantity", 0),
  ]);

  let expirySavingsEur = 0;
  let stockSavingsEur = 0;

  for (const row of (batches ?? []) as StockBatchRow[]) {
    const qty = Number(row.quantity);
    if (qty <= 0 || !row.dlc) continue;

    const unitValue = unitValueForCategory(productCategory(row.products));
    const lineValue = qty * unitValue;
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
    expirySavingsEur,
    stockSavingsEur,
    totalSavingsEur: expirySavingsEur + stockSavingsEur,
    completedReceptions,
    receptionHoursSaved,
  };
}
