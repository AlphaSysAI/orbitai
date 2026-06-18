"use server";

import { z } from "zod";

import {
  DeliveryLineRowSchema,
  type DeliveryLineRow,
} from "@/features/regiaire/reception/schemas";
import {
  getDeliveryInOrg,
  getDeliveryLineByIdInOrg,
} from "@/features/regiaire/reception/delivery-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type DecrementScanActionResult =
  | { success: true; line: DeliveryLineRow }
  | { success: false; error: string; code?: string };

export type SetLineScannedQtyActionResult =
  | { success: true; line: DeliveryLineRow }
  | { success: false; error: string; code?: string };

const SetLineScannedQtyInputSchema = z.object({
  lineId: z.string().uuid(),
  qty: z.number().int().nonnegative(),
});

async function assertLineInScanningDelivery(
  ctx: Awaited<ReturnType<typeof requireRegiaireContext>>,
  deliveryId: string,
  lineId: string
) {
  const delivery = await getDeliveryInOrg(ctx, deliveryId);
  if (!delivery) {
    return { ok: false as const, error: "Livraison introuvable" };
  }

  if (delivery.status !== "scanning") {
    return {
      ok: false as const,
      error: "La livraison n'est pas en phase de scan",
    };
  }

  const line = await getDeliveryLineByIdInOrg(ctx, deliveryId, lineId);
  if (!line) {
    return { ok: false as const, error: "Ligne introuvable" };
  }

  return { ok: true as const, delivery, line };
}

/**
 * Décrémente scanned_qty d'une ligne (annulation du dernier scan).
 * 0 ligne touchée = rien à annuler.
 */
export async function decrementScan(
  aireId: string,
  deliveryId: string,
  lineId: string
): Promise<DecrementScanActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const check = await assertLineInScanningDelivery(ctx, deliveryId, lineId);
    if (!check.ok) {
      return { success: false, error: check.error };
    }

    const { data: updatedRows, error: rpcError } = await ctx.db.rpc(
      "regiaire_decrement_scan",
      { p_line_id: lineId }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    const rows = (updatedRows ?? []) as unknown[];
    if (rows.length === 0) {
      return { success: false, error: "Rien à annuler sur cette ligne" };
    }

    return {
      success: true,
      line: DeliveryLineRowSchema.parse(rows[0]),
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de l'annulation";
    return { success: false, error: message };
  }
}

/**
 * Pose une quantité scannée précise (>= 0). Dépassement de l'attendu autorisé (surplus).
 */
export async function setLineScannedQty(
  aireId: string,
  deliveryId: string,
  lineId: string,
  qty: number
): Promise<SetLineScannedQtyActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const parsed = SetLineScannedQtyInputSchema.parse({ lineId, qty });

    const check = await assertLineInScanningDelivery(
      ctx,
      deliveryId,
      parsed.lineId
    );
    if (!check.ok) {
      return { success: false, error: check.error };
    }

    const { data, error } = await ctx.db
      .from("delivery_lines")
      .update({ scanned_qty: parsed.qty })
      .eq("id", parsed.lineId)
      .eq("delivery_id", deliveryId)
      .select(
        "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc, needs_review"
      )
      .single();

    if (error || !data) {
      return {
        success: false,
        error: error?.message ?? "Impossible de mettre à jour la quantité",
      };
    }

    return {
      success: true,
      line: DeliveryLineRowSchema.parse(data),
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error
        ? error.message
        : "Erreur lors de l'ajustement de quantité";
    return { success: false, error: message };
  }
}
