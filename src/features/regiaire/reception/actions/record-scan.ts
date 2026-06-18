"use server";

import {
  DeliveryLineRowSchema,
  RecordScanInputSchema,
  RecordScanResultSchema,
  type RecordScanResult,
} from "@/features/regiaire/reception/schemas";
import { getDeliveryInOrg } from "@/features/regiaire/reception/delivery-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type RecordScanActionResult =
  | { success: true; data: RecordScanResult }
  | { success: false; error: string; code?: string };

/**
 * Enregistre un scan EAN sur une livraison en cours.
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

    const { data: lineRaw, error: lineError } = await ctx.db
      .from("delivery_lines")
      .select("id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc")
      .eq("delivery_id", parsed.deliveryId)
      .eq("ean", parsed.ean)
      .maybeSingle();

    if (lineError || !lineRaw) {
      return {
        success: false,
        error: "Aucune ligne BL ne correspond à cet EAN",
      };
    }

    const line = DeliveryLineRowSchema.parse(lineRaw);

    const nextQty = line.scanned_qty + 1;
    if (nextQty > line.expected_qty && !parsed.extra) {
      return {
        success: false,
        error:
          "Quantité scannée supérieure à la quantité attendue (utilisez extra=true pour forcer)",
      };
    }

    const updatePayload: {
      scanned_qty: number;
      dlc?: string;
    } = { scanned_qty: nextQty };

    if (parsed.dlc && !line.dlc) {
      updatePayload.dlc = parsed.dlc;
    }

    const { data: updatedRaw, error: updateError } = await ctx.db
      .from("delivery_lines")
      .update(updatePayload)
      .eq("id", line.id)
      .select("id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc")
      .single();

    if (updateError || !updatedRaw) {
      return {
        success: false,
        error: updateError?.message ?? "Échec mise à jour du scan",
      };
    }

    const updated = DeliveryLineRowSchema.parse(updatedRaw);

    const result = RecordScanResultSchema.parse({
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
