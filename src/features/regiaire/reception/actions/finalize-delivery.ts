"use server";

import {
  DeliveryLineRowSchema,
  FinalizeDeliveryResultSchema,
  type DiscrepancyLine,
  type FinalizeDeliveryResult,
} from "@/features/regiaire/reception/schemas";
import {
  getDeliveryInOrg,
  getSupplierInOrg,
} from "@/features/regiaire/reception/delivery-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type FinalizeDeliveryActionResult =
  | { success: true; data: FinalizeDeliveryResult }
  | { success: false; error: string; code?: string };

function buildDiscrepancies(
  lines: Array<{
    ean: string;
    raw_name: string;
    expected_qty: number;
    scanned_qty: number;
  }>
): DiscrepancyLine[] {
  const discrepancies: DiscrepancyLine[] = [];

  for (const line of lines) {
    if (line.scanned_qty < line.expected_qty) {
      discrepancies.push({
        ean: line.ean,
        rawName: line.raw_name,
        expectedQty: line.expected_qty,
        scannedQty: line.scanned_qty,
        kind: "missing",
      });
    } else if (line.scanned_qty > line.expected_qty) {
      discrepancies.push({
        ean: line.ean,
        rawName: line.raw_name,
        expectedQty: line.expected_qty,
        scannedQty: line.scanned_qty,
        kind: "surplus",
      });
    }
  }

  return discrepancies;
}

function buildSupplierEmailDraft(params: {
  supplierName: string;
  supplierEmail: string | null;
  deliveryId: string;
  discrepancies: DiscrepancyLine[];
}): { to: string | null; subject: string; body: string } {
  const missing = params.discrepancies.filter((d) => d.kind === "missing");
  const surplus = params.discrepancies.filter((d) => d.kind === "surplus");

  const lines: string[] = [
    `Bonjour,`,
    ``,
    `Suite à la réception du bon de livraison (réf. ${params.deliveryId}), nous constatons les écarts suivants :`,
    ``,
  ];

  if (missing.length > 0) {
    lines.push(`--- Manquants ---`);
    for (const row of missing) {
      lines.push(
        `• ${row.rawName} (EAN ${row.ean}) : attendu ${row.expectedQty}, reçu ${row.scannedQty}`
      );
    }
    lines.push(``);
  }

  if (surplus.length > 0) {
    lines.push(`--- Surplus ---`);
    for (const row of surplus) {
      lines.push(
        `• ${row.rawName} (EAN ${row.ean}) : attendu ${row.expectedQty}, reçu ${row.scannedQty}`
      );
    }
    lines.push(``);
  }

  lines.push(
    `Merci de nous confirmer les actions correctives.`,
    ``,
    `Cordialement,`,
    `Réception ${params.supplierName}`
  );

  return {
    to: params.supplierEmail,
    subject: `Écart de livraison — BL ${params.deliveryId.slice(0, 8)}`,
    body: lines.join("\n"),
  };
}

/**
 * Finalise une réception : stock si conforme, ou écart + brouillon email fournisseur.
 * Aucun envoi email réel (provider à brancher ultérieurement).
 */
export async function finalizeDelivery(
  deliveryId: string
): Promise<FinalizeDeliveryActionResult> {
  try {
    const ctx = await requireRegiaireContext();

    const delivery = await getDeliveryInOrg(ctx, deliveryId);
    if (!delivery) {
      return { success: false, error: "Livraison introuvable" };
    }

    if (delivery.status !== "scanning" && delivery.status !== "discrepancy") {
      return {
        success: false,
        error: "Cette livraison ne peut pas être finalisée dans son état actuel",
      };
    }

    const { data: linesRaw, error: linesError } = await ctx.db
      .from("delivery_lines")
      .select(
        "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc"
      )
      .eq("delivery_id", deliveryId);

    if (linesError) {
      return { success: false, error: linesError.message };
    }

    const lines = (linesRaw ?? []).map((row) => DeliveryLineRowSchema.parse(row));

    if (lines.length === 0) {
      return { success: false, error: "Aucune ligne sur cette livraison" };
    }

    const discrepancies = buildDiscrepancies(lines);

    if (discrepancies.length > 0) {
      const supplier = await getSupplierInOrg(ctx, delivery.supplier_id);
      const draftEmail = buildSupplierEmailDraft({
        supplierName: supplier?.name ?? "Fournisseur",
        supplierEmail: supplier?.email ?? null,
        deliveryId,
        discrepancies,
      });

      const { error: updateError } = await ctx.db
        .from("deliveries")
        .update({ status: "discrepancy" })
        .eq("id", deliveryId)
        .eq("organization_id", ctx.organizationId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      const result = FinalizeDeliveryResultSchema.parse({
        status: "discrepancy",
        deliveryId,
        discrepancies,
        draftEmail,
      });

      return { success: true, data: result };
    }

    const batchRows = lines
      .filter((line) => line.scanned_qty > 0 && line.product_id)
      .map((line) => ({
        organization_id: ctx.organizationId,
        product_id: line.product_id as string,
        quantity: line.scanned_qty,
        dlc: line.dlc,
        delivery_id: deliveryId,
      }));

    if (batchRows.length === 0) {
      return {
        success: false,
        error: "Aucune quantité scannée à intégrer au stock",
      };
    }

    const { error: batchError } = await ctx.db
      .from("stock_batches")
      .insert(batchRows);

    if (batchError) {
      return { success: false, error: batchError.message };
    }

    const { error: completeError } = await ctx.db
      .from("deliveries")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", deliveryId)
      .eq("organization_id", ctx.organizationId);

    if (completeError) {
      return { success: false, error: completeError.message };
    }

    const result = FinalizeDeliveryResultSchema.parse({
      status: "completed",
      deliveryId,
      batchesCreated: batchRows.length,
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la finalisation";
    return { success: false, error: message };
  }
}
