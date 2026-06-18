"use server";

import {
  DeliveryLineRowSchema,
  RecordScanInputSchema,
  RecordScanResultSchema,
  type RecordScanResult,
} from "@/features/regiaire/reception/schemas";
import {
  getDeliveryInOrg,
  getDeliveryLineInOrg,
} from "@/features/regiaire/reception/delivery-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type RecordScanActionResult =
  | { success: true; data: RecordScanResult }
  | { success: false; error: string; code?: string };

/**
 * Enregistre un scan EAN sur une livraison en cours (incrément atomique via RPC).
 * EAN absent du BL → { status: "not_in_bl" } sans création de ligne.
 */
export async function recordScan(
  deliveryId: string,
  ean: string,
  options?: { dlc?: string; extra?: boolean }
): Promise<RecordScanActionResult> {
  try {
    const ctx = await requireRegiaireContext();

    const parsed = RecordScanInputSchema.parse({
      deliveryId,
      ean,
      dlc: options?.dlc,
      extra: options?.extra ?? false,
    });

    const delivery = await getDeliveryInOrg(ctx, parsed.deliveryId);
    if (!delivery) {
      return { success: false, error: "Livraison introuvable" };
    }

    if (delivery.status !== "scanning") {
      return {
        success: false,
        error: "La livraison n'est pas en phase de scan",
      };
    }

    const line = await getDeliveryLineInOrg(ctx, parsed.deliveryId, parsed.ean);

    if (!line) {
      const notInBl = RecordScanResultSchema.parse({
        status: "not_in_bl",
        ean: parsed.ean,
      });
      return { success: true, data: notInBl };
    }

    const allowExtra = parsed.extra || line.expected_qty === 0;

    const { data: updatedRows, error: rpcError } = await ctx.db.rpc(
      "regiaire_increment_scan",
      {
        p_line_id: line.id,
        p_allow_extra: allowExtra,
        p_dlc: parsed.dlc ?? null,
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    const rows = (updatedRows ?? []) as unknown[];
    if (rows.length === 0) {
      return {
        success: false,
        error: "La quantité dépasse l'attendu",
      };
    }

    const updated = DeliveryLineRowSchema.parse(rows[0]);

    const result = RecordScanResultSchema.parse({
      status: "scanned",
      deliveryId: parsed.deliveryId,
      lineId: updated.id,
      ean: updated.ean,
      scannedQty: updated.scanned_qty,
      expectedQty: updated.expected_qty,
      dlc: updated.dlc,
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de l'enregistrement du scan";
    return { success: false, error: message };
  }
}
