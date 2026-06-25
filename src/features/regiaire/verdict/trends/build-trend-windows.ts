// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import {
  TREND_WINDOW_DAYS,
  TrendWindowsSchema,
  type TrendWindows,
  IsoDateSchema,
} from "@/features/regiaire/verdict/schemas";
import {
  alignedLastYear,
  dateWindowEnding,
} from "@/features/regiaire/verdict/trends/iso-dates";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

type SalesRow = {
  product_id: string;
  sale_date: string;
  quantity: number;
  products: { category: string | null } | null;
};

function aggregateRows(
  rows: SalesRow[]
): { byProduct: Record<string, number>; byCategory: Record<string, number> } {
  const byProduct: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const row of rows) {
    byProduct[row.product_id] =
      (byProduct[row.product_id] ?? 0) + row.quantity;

    const category = row.products?.category?.trim() || "Sans catégorie";
    byCategory[category] = (byCategory[category] ?? 0) + row.quantity;
  }

  return { byProduct, byCategory };
}

async function loadSalesForDates(
  ctx: RegiaireContext,
  organizationId: string,
  dates: string[]
): Promise<SalesRow[]> {
  if (dates.length === 0) return [];

  if (organizationId !== ctx.organizationId) {
    throw new Error("organizationId incohérent avec le contexte RégiAire");
  }

  const { data, error } = await ctx.db
    .from("sales_history")
    .select("product_id, sale_date, quantity, products(category)")
    .eq("organization_id", organizationId)
    .eq("aire_id", ctx.aireId)
    .in("sale_date", dates);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const productJoin = row.products as unknown;
    const productMeta =
      productJoin && !Array.isArray(productJoin)
        ? (productJoin as { category: string | null })
        : null;

    return {
      product_id: row.product_id as string,
      sale_date: String(row.sale_date),
      quantity: Number(row.quantity),
      products: productMeta,
    };
  });
}

/**
 * Fenêtres de tendances 15 jours : période courante vs N-1 aligné (ISO semaine + jour).
 * Agrégations par produit et par catégorie — prêtes pour synthèse Verdict (étape 2).
 */
export async function buildTrendWindows(
  organizationId: string,
  targetDate: string,
  ctx: RegiaireContext
): Promise<TrendWindows> {
  IsoDateSchema.parse(targetDate);

  const currentDays = dateWindowEnding(targetDate, TREND_WINDOW_DAYS);
  const lastYearDays = currentDays.map((d) => alignedLastYear(d));
  const alignedTarget = alignedLastYear(targetDate);

  const [currentRows, lastYearRows] = await Promise.all([
    loadSalesForDates(ctx, organizationId, currentDays),
    loadSalesForDates(ctx, organizationId, lastYearDays),
  ]);

  const currentAgg = aggregateRows(currentRows);
  const lastYearAgg = aggregateRows(lastYearRows);

  return TrendWindowsSchema.parse({
    organizationId,
    targetDate,
    windowDays: TREND_WINDOW_DAYS,
    current: {
      from: currentDays[0]!,
      to: currentDays[currentDays.length - 1]!,
      days: currentDays,
      byProduct: currentAgg.byProduct,
      byCategory: currentAgg.byCategory,
    },
    lastYear: {
      from: lastYearDays[0]!,
      to: lastYearDays[lastYearDays.length - 1]!,
      days: lastYearDays,
      alignedTargetDate: alignedTarget,
      byProduct: lastYearAgg.byProduct,
      byCategory: lastYearAgg.byCategory,
    },
  });
}

/** Réexport utilitaire alignement N-1. */
export { alignedLastYear } from "@/features/regiaire/verdict/trends/iso-dates";
