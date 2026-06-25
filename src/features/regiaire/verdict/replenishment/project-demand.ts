// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import {
  getCategoryMultipliersForDay,
  type DayDemandContext,
} from "@/features/regiaire/verdict/replenishment/demand-multipliers";
import {
  REPLENISHMENT_BASELINE_WEEKS,
  REPLENISHMENT_HORIZON_DAYS,
} from "@/features/regiaire/verdict/replenishment/schemas";
import {
  addDaysIso,
  dateWindowEnding,
  getIsoWeekAndWeekday,
} from "@/features/regiaire/verdict/trends/iso-dates";

/** Baseline par produit et jour ISO (1=lundi … 7=dimanche). */
export type ProductWeekdayBaselines = Map<
  string,
  Map<number, number>
>;

export type ProductMeta = {
  id: string;
  ean: string;
  name: string;
  category: string;
};

export type ProjectedDemandByProduct = Map<
  string,
  {
    total: number;
    byDay: Array<{ date: string; demand: number; reasons: string[] }>;
    allReasons: string[];
  }
>;

function countWeekdaysInWindow(
  dates: string[]
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const date of dates) {
    const { weekday } = getIsoWeekAndWeekday(date);
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }
  return counts;
}

export async function loadProductWeekdayBaselines(
  ctx: RegiaireContext,
  endDate: string,
  weeks: number = REPLENISHMENT_BASELINE_WEEKS
): Promise<ProductWeekdayBaselines> {
  const historyDays = dateWindowEnding(endDate, weeks * 7);
  const weekdayCounts = countWeekdaysInWindow(historyDays);

  const { data, error } = await ctx.db
    .from("sales_history")
    .select("product_id, sale_date, quantity")
    .eq("organization_id", ctx.organizationId)
    .eq("aire_id", ctx.aireId)
    .in("sale_date", historyDays);

  if (error) {
    throw new Error(error.message);
  }

  const sums = new Map<string, Map<number, number>>();

  for (const row of data ?? []) {
    const productId = row.product_id as string;
    const saleDate = String(row.sale_date);
    const qty = Number(row.quantity);
    const { weekday } = getIsoWeekAndWeekday(saleDate);

    const byWeekday = sums.get(productId) ?? new Map<number, number>();
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + qty);
    sums.set(productId, byWeekday);
  }

  const baselines: ProductWeekdayBaselines = new Map();

  for (const [productId, byWeekday] of sums) {
    const baselineMap = new Map<number, number>();
    for (const [weekday, total] of byWeekday) {
      const occurrences = weekdayCounts.get(weekday) ?? 1;
      baselineMap.set(weekday, total / occurrences);
    }
    baselines.set(productId, baselineMap);
  }

  return baselines;
}

export function getBaselineForDate(
  baselines: ProductWeekdayBaselines,
  productId: string,
  date: string
): number {
  const { weekday } = getIsoWeekAndWeekday(date);
  return baselines.get(productId)?.get(weekday) ?? 0;
}

export function projectDemandForProducts(
  products: ProductMeta[],
  baselines: ProductWeekdayBaselines,
  dayContexts: DayDemandContext[],
  planDate: string,
  horizonDays: number = REPLENISHMENT_HORIZON_DAYS
): ProjectedDemandByProduct {
  const dates = Array.from({ length: horizonDays }, (_, i) =>
    addDaysIso(planDate, i)
  );
  const result: ProjectedDemandByProduct = new Map();

  for (const product of products) {
    const byDay: Array<{ date: string; demand: number; reasons: string[] }> =
      [];
    const reasonSet = new Set<string>();
    let total = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i]!;
      const dayCtx = dayContexts[i]!;
      const baseline = getBaselineForDate(baselines, product.id, date);
      const { factor, reasons } = getCategoryMultipliersForDay(
        product.category,
        dayCtx
      );
      const demand = baseline * factor;
      total += demand;
      for (const r of reasons) reasonSet.add(r);
      byDay.push({ date, demand, reasons });
    }

    result.set(product.id, {
      total,
      byDay,
      allReasons: Array.from(reasonSet),
    });
  }

  return result;
}
