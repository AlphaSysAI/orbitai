// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import {
  ConfirmReviewResultSchema,
  DeliveryLineRowSchema,
  type ConfirmReviewResult,
} from "@/features/regiaire/reception/schemas";
import { getDeliveryInOrg } from "@/features/regiaire/reception/delivery-access";
import { lineNeedsReview } from "@/features/regiaire/reception/validate-bl-line";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type ConfirmReviewActionResult =
  | { success: true; data: ConfirmReviewResult }
  | { success: false; error: string; code?: string };

/**
 * Valide la revue BL et passe la livraison en phase scan.
 * Refuse si une ligne a encore needs_review ou nom/qté invalides.
 */
export async function confirmReview(
  aireId: string,
  deliveryId: string
): Promise<ConfirmReviewActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);

    const delivery = await getDeliveryInOrg(ctx, deliveryId);
    if (!delivery) {
      return { success: false, error: "Livraison introuvable" };
    }

    if (delivery.status !== "draft") {
      return {
        success: false,
        error: "Cette livraison n'est pas en revue",
      };
    }

    if (!delivery.bl_file_path) {
      return {
        success: false,
        error: "Aucun bon de livraison analysé",
      };
    }

    const { data: linesRaw, error: linesError } = await ctx.db
      .from("delivery_lines")
      .select(
        "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc, needs_review"
      )
      .eq("delivery_id", deliveryId);

    if (linesError) {
      return { success: false, error: linesError.message };
    }

    const lines = (linesRaw ?? []).map((row) => DeliveryLineRowSchema.parse(row));

    if (lines.length === 0) {
      return { success: false, error: "Aucune ligne à confirmer" };
    }

    for (const line of lines) {
      if (line.needs_review || lineNeedsReview(line.raw_name, line.expected_qty)) {
        return {
          success: false,
          error:
            "Des lignes nécessitent encore une correction (nom ou quantité)",
        };
      }
    }

    const { error: updateError } = await ctx.db
      .from("deliveries")
      .update({ status: "scanning" })
      .eq("id", deliveryId)
      .eq("organization_id", ctx.organizationId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    const result = ConfirmReviewResultSchema.parse({
      deliveryId,
      status: "scanning",
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la confirmation";
    return { success: false, error: message };
  }
}
