// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import {
  DeliveryLineRowSchema,
  RecordScanSuccessSchema,
  type RecordScanSuccess,
} from "@/features/regiaire/reception/schemas";
import {
  getDeliveryInOrg,
  getDeliveryLineByIdInOrg,
  upsertProductForLine,
} from "@/features/regiaire/reception/delivery-access";
import { isValidEan13 } from "@/features/regiaire/reception/validate-bl-line";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type BindEanToLineActionResult =
  | { success: true; data: RecordScanSuccess }
  | { success: false; error: string; code?: string };

/**
 * Lie un EAN scanné à une ligne en instance (ean NULL), puis compte le 1er scan.
 */
export async function bindEanToLine(
  aireId: string,
  deliveryId: string,
  lineId: string,
  ean: string
): Promise<BindEanToLineActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const trimmedEan = ean.replace(/\D/g, "");

    if (!trimmedEan || !isValidEan13(trimmedEan)) {
      return { success: false, error: "EAN invalide" };
    }

    const delivery = await getDeliveryInOrg(ctx, deliveryId);
    if (!delivery) {
      return { success: false, error: "Livraison introuvable" };
    }

    if (delivery.status !== "scanning") {
      return {
        success: false,
        error: "La livraison n'est pas en phase de scan",
      };
    }

    const line = await getDeliveryLineByIdInOrg(ctx, deliveryId, lineId);
    if (!line) {
      return { success: false, error: "Ligne introuvable" };
    }

    if (line.ean !== null) {
      return { success: false, error: "Cette ligne a déjà un EAN" };
    }

    const { data: conflict } = await ctx.db
      .from("delivery_lines")
      .select("id")
      .eq("delivery_id", deliveryId)
      .eq("ean", trimmedEan)
      .maybeSingle();

    if (conflict) {
      return {
        success: false,
        error: "Cet EAN est déjà présent sur une autre ligne du BL",
      };
    }

    const hasDlc = line.dlc !== null;
    const productId = await upsertProductForLine(
      ctx,
      trimmedEan,
      line.raw_name,
      hasDlc,
      delivery.supplier_id
    );

    const { data: boundRows, error: bindError } = await ctx.db
      .from("delivery_lines")
      .update({ ean: trimmedEan, product_id: productId })
      .eq("id", lineId)
      .eq("delivery_id", deliveryId)
      .is("ean", null)
      .select(
        "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc"
      );

    if (bindError || !boundRows?.length) {
      return {
        success: false,
        error: bindError?.message ?? "Impossible de lier l'EAN à la ligne",
      };
    }

    const { data: updatedRows, error: rpcError } = await ctx.db.rpc(
      "regiaire_increment_scan",
      {
        p_line_id: lineId,
        p_allow_extra: false,
        p_dlc: null,
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    const rows = (updatedRows ?? []) as unknown[];
    if (rows.length === 0) {
      return {
        success: false,
        error: "Impossible d'enregistrer le premier scan",
      };
    }

    const updated = DeliveryLineRowSchema.parse(rows[0]);

    const result = RecordScanSuccessSchema.parse({
      status: "scanned",
      deliveryId,
      lineId: updated.id,
      ean: updated.ean ?? trimmedEan,
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
      error instanceof Error ? error.message : "Erreur lors de la liaison EAN";
    return { success: false, error: message };
  }
}
