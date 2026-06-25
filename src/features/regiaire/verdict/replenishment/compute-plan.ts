// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import { requireStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import { buildDayDemandContexts } from "@/features/regiaire/verdict/replenishment/build-demand-context";
import {
  loadProductWeekdayBaselines,
  projectDemandForProducts,
  type ProductMeta,
} from "@/features/regiaire/verdict/replenishment/project-demand";
import {
  REPLENISHMENT_HORIZON_DAYS,
  REPLENISHMENT_SAFETY_MARGIN,
  REPLENISHMENT_TOP_SELLERS_PER_CATEGORY,
  ReplenishmentLineSchema,
  ReplenishmentPlanSchema,
  type ReplenishmentLine,
  type ReplenishmentPlan,
} from "@/features/regiaire/verdict/replenishment/schemas";
import {
  addDaysIso,
  dateWindowEnding,
  getIsoWeekAndWeekday,
} from "@/features/regiaire/verdict/trends/iso-dates";

const TOP_SELLER_WINDOW_DAYS = 30;
const STOCKOUT_RISK_DAYS = 2;

type ProductWithSupplier = ProductMeta & {
  supplier: {
    id: string;
    name: string;
    leadTimeDays: number;
  } | null;
};

function findLastOrderDate(
  orderDays: number[],
  stockoutDate: string,
  leadTimeDays: number
): string | null {
  const sorted = [...orderDays].sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const orderDeadline = addDaysIso(stockoutDate, -leadTimeDays);

  for (let offset = 0; offset <= 21; offset++) {
    const candidate = addDaysIso(orderDeadline, -offset);
    const { weekday } = getIsoWeekAndWeekday(candidate);
    if (sorted.includes(weekday)) {
      return candidate;
    }
  }

  return null;
}

function findStockoutDate(
  currentStock: number,
  byDay: Array<{ date: string; demand: number }>
): string | null {
  let remaining = currentStock;

  for (const day of byDay) {
    remaining -= day.demand;
    if (remaining <= 0) {
      return day.date;
    }
  }

  if (byDay.length > 0) {
    return byDay[byDay.length - 1]!.date;
  }

  return null;
}

function suggestedQtyFromShortfall(shortfall: number): number {
  if (shortfall <= 0) return 0;
  return Math.ceil(shortfall * REPLENISHMENT_SAFETY_MARGIN);
}

async function loadCurrentStockByProduct(
  ctx: RegiaireContext
): Promise<Map<string, number>> {
  const { data, error } = await ctx.db
    .from("stock_batches")
    .select("product_id, quantity")
    .eq("organization_id", ctx.organizationId)
    .eq("aire_id", ctx.aireId)
    .gt("quantity", 0);

  if (error) {
    throw new Error(error.message);
  }

  const stock = new Map<string, number>();
  for (const row of data ?? []) {
    const productId = row.product_id as string;
    stock.set(productId, (stock.get(productId) ?? 0) + Number(row.quantity));
  }
  return stock;
}

async function loadProductsWithSuppliers(
  ctx: RegiaireContext
): Promise<ProductWithSupplier[]> {
  const { data, error } = await ctx.db
    .from("products")
    .select(
      "id, ean, name, category, supplier_id, suppliers(id, name, lead_time_days)"
    )
    .eq("organization_id", ctx.organizationId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const supplierJoin = row.suppliers as unknown;
    const supplierMeta =
      supplierJoin && !Array.isArray(supplierJoin)
        ? (supplierJoin as {
            id: string;
            name: string;
            lead_time_days: number;
          })
        : null;

    return {
      id: row.id as string,
      ean: row.ean as string,
      name: row.name as string,
      category: (row.category as string | null)?.trim() || "Divers",
      supplier: supplierMeta
        ? {
            id: supplierMeta.id,
            name: supplierMeta.name,
            leadTimeDays: Number(supplierMeta.lead_time_days ?? 0),
          }
        : null,
    };
  });
}

async function selectFocusProductIds(
  ctx: RegiaireContext,
  planDate: string,
  allProducts: ProductWithSupplier[],
  stockByProduct: Map<string, number>,
  projectedDemand: ReturnType<typeof projectDemandForProducts>
): Promise<Set<string>> {
  const focus = new Set<string>();
  const recentDays = dateWindowEnding(planDate, TOP_SELLER_WINDOW_DAYS);

  const { data, error } = await ctx.db
    .from("sales_history")
    .select("product_id, quantity, products(category)")
    .eq("organization_id", ctx.organizationId)
    .eq("aire_id", ctx.aireId)
    .in("sale_date", recentDays);

  if (error) {
    throw new Error(error.message);
  }

  const salesByCategory = new Map<string, Map<string, number>>();

  for (const row of data ?? []) {
    const productId = row.product_id as string;
    const productsJoin = row.products as unknown;
    const category =
      productsJoin && !Array.isArray(productsJoin)
        ? ((productsJoin as { category: string | null }).category?.trim() ||
            "Divers")
        : "Divers";

    const byProduct = salesByCategory.get(category) ?? new Map<string, number>();
    byProduct.set(productId, (byProduct.get(productId) ?? 0) + Number(row.quantity));
    salesByCategory.set(category, byProduct);
  }

  for (const [, byProduct] of salesByCategory) {
    const top = [...byProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, REPLENISHMENT_TOP_SELLERS_PER_CATEGORY)
      .map(([id]) => id);
    for (const id of top) focus.add(id);
  }

  for (const product of allProducts) {
    const projection = projectedDemand.get(product.id);
    if (!projection) continue;

    const currentStock = stockByProduct.get(product.id) ?? 0;
    const nearTermDemand = projection.byDay
      .slice(0, STOCKOUT_RISK_DAYS)
      .reduce((sum, d) => sum + d.demand, 0);

    if (currentStock < nearTermDemand && nearTermDemand > 0) {
      focus.add(product.id);
    }
  }

  return focus;
}

export async function computeReplenishmentPlan(
  ctx: RegiaireContext,
  planDate: string
): Promise<ReplenishmentPlan> {
  const settings = await requireStationSettings(ctx);
  const dayContexts = await buildDayDemandContexts(
    ctx,
    planDate,
    REPLENISHMENT_HORIZON_DAYS
  );

  const [baselines, allProducts, stockByProduct] = await Promise.all([
    loadProductWeekdayBaselines(ctx, planDate),
    loadProductsWithSuppliers(ctx),
    loadCurrentStockByProduct(ctx),
  ]);

  const projectedDemand = projectDemandForProducts(
    allProducts,
    baselines,
    dayContexts,
    planDate
  );

  const focusIds = await selectFocusProductIds(
    ctx,
    planDate,
    allProducts,
    stockByProduct,
    projectedDemand
  );

  const lines: ReplenishmentLine[] = [];

  for (const product of allProducts) {
    if (!focusIds.has(product.id)) continue;

    const projection = projectedDemand.get(product.id);
    if (!projection) continue;

    const currentStock = stockByProduct.get(product.id) ?? 0;
    const projectedTotal = projection.total;
    const shortfall = Math.max(0, projectedTotal - currentStock);
    const suggestedOrderQty = suggestedQtyFromShortfall(shortfall);

    const stockoutDate =
      shortfall > 0 ? findStockoutDate(currentStock, projection.byDay) : null;

    const orderByDate =
      stockoutDate != null && product.supplier != null
        ? findLastOrderDate(
            settings.orderDays,
            stockoutDate,
            product.supplier.leadTimeDays
          )
        : null;

    const line = ReplenishmentLineSchema.parse({
      product: {
        id: product.id,
        ean: product.ean,
        name: product.name,
        category: product.category,
      },
      category: product.category,
      currentStock,
      projectedDemand: Math.round(projectedTotal * 10) / 10,
      suggestedOrderQty,
      orderByDate,
      supplier: product.supplier,
      reason: projection.allReasons,
    });

    const firstDayDemand = projection.byDay[0]?.demand ?? 0;
    if (suggestedOrderQty > 0 || currentStock < firstDayDemand) {
      lines.push(line);
    }
  }

  lines.sort(
    (a, b) =>
      b.suggestedOrderQty - a.suggestedOrderQty ||
      b.projectedDemand - a.projectedDemand
  );

  return ReplenishmentPlanSchema.parse({
    aireId: ctx.aireId,
    organizationId: ctx.organizationId,
    planDate,
    horizonDays: REPLENISHMENT_HORIZON_DAYS,
    lines,
    v1Limitations: [
      "Les commandes déjà passées ne sont pas prises en compte (pas de suivi commandes en v1).",
      "Le stock actuel ne déduit pas les ventes déjà réalisées aujourd'hui.",
      "Baseline issue de sales_history (seed démo si pas de POS branché).",
    ],
  });
}
