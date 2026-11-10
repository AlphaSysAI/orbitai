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
  aireId: string,
  deliveryId: string
): Promise<FinalizeDeliveryActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);

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
    const { discrepancies, unexpected } = buildDeliveryReportFromLines(lines);

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
