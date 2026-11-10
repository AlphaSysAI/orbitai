// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import {
  DeliveryLineRowSchema,
  FinalizeDeliveryReportSchema,
  type FinalizeDeliveryReport,
} from "@/features/regiaire/reception/schemas";
import {
  buildDeliveryReportFromLines,
  buildSupplierEmailDraft,
} from "@/features/regiaire/reception/delivery-report";
import {
  getDeliveryInOrg,
  getSupplierInOrg,
} from "@/features/regiaire/reception/delivery-access";
import { isTerminalStatus } from "@/features/regiaire/reception/utils/delivery-ui";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type GetDeliveryReportActionResult =
  | { success: true; data: FinalizeDeliveryReport }
  | { success: false; error: string; code?: string };

async function loadDeliveryLines(
  ctx: Awaited<ReturnType<typeof requireRegiaireContext>>,
  deliveryId: string
) {
  const { data: linesRaw, error: linesError } = await ctx.db
    .from("delivery_lines")
    .select(
      "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc, needs_review"
    )
    .eq("delivery_id", deliveryId);

  if (linesError) {
    throw new Error(linesError.message);
  }

  return (linesRaw ?? []).map((row) => DeliveryLineRowSchema.parse(row));
}

/** Reconstruit le rapport de finalisation pour une livraison terminée. */
export async function getDeliveryReport(
  aireId: string,
  deliveryId: string
): Promise<GetDeliveryReportActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);

    const delivery = await getDeliveryInOrg(ctx, deliveryId);
    if (!delivery) {
      return { success: false, error: "Livraison introuvable" };
    }

    if (!isTerminalStatus(delivery.status)) {
      return {
        success: false,
        error: "Cette livraison n'est pas encore finalisée",
        code: "not_finalized",
      };
    }

    const lines = await loadDeliveryLines(ctx, deliveryId);
    const { discrepancies, unexpected } = buildDeliveryReportFromLines(lines);

    const { count: batchesCreated, error: batchError } = await ctx.db
      .from("stock_batches")
      .select("*", { count: "exact", head: true })
      .eq("delivery_id", deliveryId);

    if (batchError) {
      return { success: false, error: batchError.message };
    }

    const supplier = await getSupplierInOrg(ctx, delivery.supplier_id);

    const reportStatus =
      delivery.status === "discrepancy" ? "discrepancy" : "completed";

    let draftEmail:
      | { to: string | null; subject: string; body: string }
      | undefined;

    if (
      reportStatus === "discrepancy" &&
      (discrepancies.length > 0 || unexpected.length > 0)
    ) {
      draftEmail = buildSupplierEmailDraft({
        supplierName: supplier?.name ?? "Fournisseur",
        supplierEmail: supplier?.email ?? null,
        deliveryId,
        discrepancies,
        unexpected,
      });
    }

    const report = FinalizeDeliveryReportSchema.parse({
      status: reportStatus,
      deliveryId,
      batchesCreated: batchesCreated ?? 0,
      discrepancies,
      unexpected,
      draftEmail,
    });

    return { success: true, data: report };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors du chargement";
    return { success: false, error: message };
  }
}
