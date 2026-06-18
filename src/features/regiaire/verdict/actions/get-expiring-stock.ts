"use server";

import {
  ExpiringStockItemSchema,
  ExpiringStockResultSchema,
  IsoDateSchema,
  type ExpiringStockResult,
} from "@/features/regiaire/verdict/schemas";
import { daysBetweenIso, todayParisIso } from "@/features/regiaire/verdict/lib/dates";
import { addDaysIso } from "@/features/regiaire/verdict/trends/iso-dates";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type GetExpiringStockActionResult =
  | { success: true; data: ExpiringStockResult }
  | { success: false; error: string; code?: string };

function urgencyFromDays(joursRestants: number): "perime" | "j1" | "j2" | "j3" {
  if (joursRestants <= 0) return "perime";
  if (joursRestants === 1) return "j1";
  if (joursRestants === 2) return "j2";
  return "j3";
}

/**
 * Lots en péremption : DLC <= targetDate (priorité), puis J+1 à J+3.
 * Source : stock_batches réel (org-scoped).
 */
export async function getExpiringStock(
  targetDate?: string
): Promise<GetExpiringStockActionResult> {
  try {
    const ctx = await requireRegiaireContext();
    const date = targetDate ? IsoDateSchema.parse(targetDate) : todayParisIso();
    const horizon = addDaysIso(date, 3);

    const { data, error } = await ctx.db
      .from("stock_batches")
      .select("quantity, dlc, product_id, products(id, name, category)")
      .eq("organization_id", ctx.organizationId)
      .eq("aire_id", ctx.aireId)
      .not("dlc", "is", null)
      .lte("dlc", horizon)
      .gt("quantity", 0)
      .order("dlc", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const perimes: ExpiringStockResult["perimes"] = [];
    const proches: ExpiringStockResult["proches"] = [];

    for (const row of data ?? []) {
      const dlc = String(row.dlc);
      const joursRestants = daysBetweenIso(date, dlc);
      if (joursRestants > 3) continue;

      const products = row.products as unknown;
      const productMeta =
        products && !Array.isArray(products)
          ? (products as { id: string; name: string; category: string | null })
          : null;

      if (!productMeta?.name) continue;

      const item = ExpiringStockItemSchema.parse({
        productId: row.product_id as string,
        productName: productMeta.name,
        category: productMeta.category,
        quantity: Number(row.quantity),
        dlc,
        joursRestants,
        urgency: urgencyFromDays(joursRestants),
      });

      if (joursRestants <= 0) {
        perimes.push(item);
      } else {
        proches.push(item);
      }
    }

    const sortByUrgency = (
      a: (typeof perimes)[number],
      b: (typeof perimes)[number]
    ) => a.joursRestants - b.joursRestants || a.dlc.localeCompare(b.dlc);

    perimes.sort(sortByUrgency);
    proches.sort(sortByUrgency);

    const result = ExpiringStockResultSchema.parse({
      targetDate: date,
      perimes,
      proches,
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors du chargement des périmés" };
  }
}
