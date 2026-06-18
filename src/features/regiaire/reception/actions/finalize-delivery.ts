"use server";

import {
  DeliveryLineRowSchema,
  FinalizeDeliveryReportSchema,
  formatEanForReport,
  type DiscrepancyLine,
  type FinalizeDeliveryReport,
  type UnexpectedLine,
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
  | { success: true; data: FinalizeDeliveryReport }
  | { success: false; error: string; code?: string };

type FinalizeRpcRow = {
  outcome: string;
  batches_created: number;
};

function buildFinalizeReport(lines: Array<{
  ean: string | null;
  raw_name: string;
  expected_qty: number;
  scanned_qty: number;
}>): {
  discrepancies: DiscrepancyLine[];
  unexpected: UnexpectedLine[];
} {
  const discrepancies: DiscrepancyLine[] = [];
  const unexpected: UnexpectedLine[] = [];

  for (const line of lines) {
    if (line.expected_qty === 0 && line.scanned_qty > 0) {
      if (!line.ean) continue;
      unexpected.push({
        ean: line.ean,
        rawName: line.raw_name,
        scannedQty: line.scanned_qty,
      });
      continue;
    }

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

  return { discrepancies, unexpected };
}

function buildSupplierEmailDraft(params: {
  supplierName: string;
  supplierEmail: string | null;
  deliveryId: string;
  discrepancies: DiscrepancyLine[];
  unexpected: UnexpectedLine[];
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
        `• ${row.rawName} (EAN ${formatEanForReport(row.ean)}) : attendu ${row.expectedQty}, reçu ${row.scannedQty}`
      );
    }
    lines.push(``);
  }

  if (surplus.length > 0) {
    lines.push(`--- Surplus (BL) ---`);
    for (const row of surplus) {
      lines.push(
        `• ${row.rawName} (EAN ${formatEanForReport(row.ean)}) : attendu ${row.expectedQty}, reçu ${row.scannedQty}`
      );
    }
    lines.push(``);
  }

  if (params.unexpected.length > 0) {
    lines.push(`--- Produits non prévus au BL ---`);
    for (const row of params.unexpected) {
      lines.push(`• ${row.rawName} (EAN ${row.ean}) : ${row.scannedQty} unité(s) reçue(s)`);
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

/**
 * Finalise une réception : stock toujours (RPC), rapport écarts en TS.
 * États terminaux : completed | discrepancy — second appel → already_finalized.
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

    if (delivery.status !== "scanning") {
      return {
        success: false,
        error: "Cette livraison a déjà été finalisée ou n'est pas en scan",
      };
    }

    const { data: rpcRaw, error: rpcError } = await ctx.db.rpc(
      "regiaire_finalize_delivery",
      { p_delivery_id: deliveryId }
    );

    if (rpcError) {
      const message = rpcError.message;
      if (message.includes("no_scanned_stock")) {
        return {
          success: false,
          error: "Aucune quantité scannée à intégrer au stock",
        };
      }
      if (message.includes("no_lines")) {
        return { success: false, error: "Aucune ligne sur cette livraison" };
      }
      return { success: false, error: message };
    }

    const rpcRows = (rpcRaw ?? []) as FinalizeRpcRow[];
    const rpcResult = rpcRows[0];

    if (!rpcResult) {
      return { success: false, error: "Réponse RPC invalide" };
    }

    if (rpcResult.outcome === "already_finalized") {
      return {
        success: false,
        error: "Cette livraison a déjà été finalisée",
      };
    }

    const lines = await loadDeliveryLines(ctx, deliveryId);
    const { discrepancies, unexpected } = buildFinalizeReport(lines);

    const needsEmail =
      rpcResult.outcome === "discrepancy" &&
      (discrepancies.length > 0 || unexpected.length > 0);

    let draftEmail: { to: string | null; subject: string; body: string } | undefined;
    if (needsEmail) {
      const supplier = await getSupplierInOrg(ctx, delivery.supplier_id);
      draftEmail = buildSupplierEmailDraft({
        supplierName: supplier?.name ?? "Fournisseur",
        supplierEmail: supplier?.email ?? null,
        deliveryId,
        discrepancies,
        unexpected,
      });
    }

    const report = FinalizeDeliveryReportSchema.parse({
      status: rpcResult.outcome,
      deliveryId,
      batchesCreated: rpcResult.batches_created,
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
      error instanceof Error ? error.message : "Erreur lors de la finalisation";
    return { success: false, error: message };
  }
}
