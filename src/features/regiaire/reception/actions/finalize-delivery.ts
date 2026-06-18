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

type FinalizeRpcRow = {
  outcome: string;
  batches_created: number;
};

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

async function loadDeliveryLines(
  ctx: Awaited<ReturnType<typeof requireRegiaireContext>>,
  deliveryId: string
) {
  const { data: linesRaw, error: linesError } = await ctx.db
    .from("delivery_lines")
    .select(
      "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc"
    )
    .eq("delivery_id", deliveryId);

  if (linesError) {
    throw new Error(linesError.message);
  }

  return (linesRaw ?? []).map((row) => DeliveryLineRowSchema.parse(row));
}

/**
 * Finalise une réception : transition + stock via RPC atomique ;
 * écarts et brouillon email calculés en TS sur le résultat.
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

    if (rpcResult.outcome === "discrepancy") {
      const lines = await loadDeliveryLines(ctx, deliveryId);
      const discrepancies = buildDiscrepancies(lines);
      const supplier = await getSupplierInOrg(ctx, delivery.supplier_id);
      const draftEmail = buildSupplierEmailDraft({
        supplierName: supplier?.name ?? "Fournisseur",
        supplierEmail: supplier?.email ?? null,
        deliveryId,
        discrepancies,
      });

      const result = FinalizeDeliveryResultSchema.parse({
        status: "discrepancy",
        deliveryId,
        discrepancies,
        draftEmail,
      });

      return { success: true, data: result };
    }

    if (rpcResult.outcome === "completed") {
      const result = FinalizeDeliveryResultSchema.parse({
        status: "completed",
        deliveryId,
        batchesCreated: rpcResult.batches_created,
      });

      return { success: true, data: result };
    }

    return { success: false, error: `Résultat RPC inconnu : ${rpcResult.outcome}` };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la finalisation";
    return { success: false, error: message };
  }
}
