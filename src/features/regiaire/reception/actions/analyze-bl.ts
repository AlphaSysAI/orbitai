// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import {
  AnalyzeBLResultSchema,
  type AnalyzeBLResult,
} from "@/features/regiaire/reception/schemas";
import {
  aggregateBlLines,
  getDeliveryInOrg,
  upsertProductForLine,
} from "@/features/regiaire/reception/delivery-access";
import { parseBlDocument } from "@/features/regiaire/reception/parse-bl";
import { normalizeExtractedLine } from "@/features/regiaire/reception/validate-bl-line";
import {
  buildBlStoragePath,
  REGIAIRE_BL_BUCKET,
} from "@/lib/regiaire/constants";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

const MAX_BL_BYTES = 10 * 1024 * 1024;

export type AnalyzeBLActionResult =
  | { success: true; data: AnalyzeBLResult }
  | { success: false; error: string; code?: string };

/**
 * Analyse IA d'un bon de livraison : upload storage + extraction à incertitude.
 * Écrit les lignes en statut draft (revue requise avant scan).
 */
export async function analyzeBL(
  aireId: string,
  deliveryId: string,
  formData: FormData
): Promise<AnalyzeBLActionResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);

    const delivery = await getDeliveryInOrg(ctx, deliveryId);
    if (!delivery) {
      return { success: false, error: "Livraison introuvable" };
    }

    if (delivery.status !== "draft") {
      return {
        success: false,
        error: "Cette livraison ne peut plus être analysée",
      };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { success: false, error: "Fichier BL requis" };
    }

    if (file.size > MAX_BL_BYTES) {
      return { success: false, error: "Fichier trop volumineux (max 10 Mo)" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await parseBlDocument(buffer, file.type, file.name);
    const normalized = extraction.lines.map(normalizeExtractedLine);
    const mergedLines = aggregateBlLines(normalized);

    const storagePath = buildBlStoragePath(
      ctx.organizationId,
      deliveryId,
      file.name
    );

    const { error: uploadError } = await ctx.supabase.storage
      .from(REGIAIRE_BL_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: uploadError.message ?? "Échec upload du BL",
      };
    }

    const { error: deleteLinesError } = await ctx.db
      .from("delivery_lines")
      .delete()
      .eq("delivery_id", deliveryId);

    if (deleteLinesError) {
      return { success: false, error: deleteLinesError.message };
    }

    const lineRows = [];
    for (const line of mergedLines) {
      let productId: string | null = null;
      if (line.ean) {
        const hasDlc = line.dlc !== null;
        productId = await upsertProductForLine(
          ctx,
          line.ean,
          line.raw_name,
          hasDlc,
          delivery.supplier_id
        );
      }

      lineRows.push({
        delivery_id: deliveryId,
        product_id: productId,
        raw_name: line.raw_name,
        ean: line.ean,
        expected_qty: line.expected_qty,
        scanned_qty: 0,
        dlc: line.dlc,
        needs_review: line.needs_review,
      });
    }

    const { error: insertLinesError } = await ctx.db
      .from("delivery_lines")
      .insert(lineRows);

    if (insertLinesError) {
      return { success: false, error: insertLinesError.message };
    }

    const { error: updateDeliveryError } = await ctx.db
      .from("deliveries")
      .update({
        bl_file_path: storagePath,
      })
      .eq("id", deliveryId)
      .eq("organization_id", ctx.organizationId);

    if (updateDeliveryError) {
      return { success: false, error: updateDeliveryError.message };
    }

    const needsReviewCount = lineRows.filter((l) => l.needs_review).length;

    const result = AnalyzeBLResultSchema.parse({
      deliveryId,
      status: "draft",
      lineCount: lineRows.length,
      blFilePath: storagePath,
      needsReviewCount,
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de l'analyse du BL";
    return { success: false, error: message };
  }
}
