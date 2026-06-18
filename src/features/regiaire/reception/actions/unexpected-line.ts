"use server";

import { z } from "zod";

import {
  DeliveryLineRowSchema,
  ProductLookupSchema,
} from "@/features/regiaire/reception/schemas";
import {
  getDeliveryInOrg,
  getDeliveryLineInOrg,
  getProductByEanInOrg,
  getProductByIdInOrg,
  upsertProductForLine,
} from "@/features/regiaire/reception/delivery-access";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type LookupProductByEanResult =
  | { success: true; product: z.infer<typeof ProductLookupSchema> | null }
  | { success: false; error: string; code?: string };

/**
 * Recherche un produit catalogue par EAN dans l'organisation courante.
 */
export async function lookupProductByEan(
  aireId: string,
  ean: string
): Promise<LookupProductByEanResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const trimmed = ean.trim();
    if (!trimmed) {
      return { success: false, error: "EAN requis" };
    }

    const product = await getProductByEanInOrg(ctx, trimmed);
    if (!product) {
      return { success: true, product: null };
    }

    return {
      success: true,
      product: ProductLookupSchema.parse(product),
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la recherche produit";
    return { success: false, error: message };
  }
}

const AddUnexpectedLineInputSchema = z
  .object({
    deliveryId: z.string().uuid(),
    ean: z.string().min(1),
    productId: z.string().uuid().optional(),
    newName: z.string().min(1).optional(),
  })
  .refine(
    (value) =>
      (value.productId !== undefined && value.newName === undefined) ||
      (value.productId === undefined && value.newName !== undefined),
    { message: "Fournir productId ou newName, pas les deux" }
  );

export type AddUnexpectedLineResult =
  | { success: true; line: z.infer<typeof DeliveryLineRowSchema> }
  | { success: false; error: string; code?: string };

/**
 * Ajoute une ligne non-attendue (expected_qty=0), idempotente sur (delivery_id, ean).
 * scanned_qty initial = 1. Produit lié via productId existant ou newName (upsert).
 */
export async function addUnexpectedLine(
  aireId: string,
  deliveryId: string,
  ean: string,
  options: { productId?: string; newName?: string }
): Promise<AddUnexpectedLineResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);

    const parsed = AddUnexpectedLineInputSchema.parse({
      deliveryId,
      ean,
      productId: options.productId,
      newName: options.newName,
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

    const existing = await getDeliveryLineInOrg(
      ctx,
      parsed.deliveryId,
      parsed.ean
    );
    if (existing) {
      return {
        success: true,
        line: DeliveryLineRowSchema.parse(existing),
      };
    }

    let productId: string;
    let rawName: string;

    if (parsed.productId) {
      const product = await getProductByIdInOrg(ctx, parsed.productId);
      if (!product) {
        return { success: false, error: "Produit introuvable" };
      }
      if (product.ean !== parsed.ean) {
        return {
          success: false,
          error: "Le produit ne correspond pas à l'EAN scanné",
        };
      }
      productId = product.id;
      rawName = product.name;
    } else {
      rawName = parsed.newName!;
      productId = await upsertProductForLine(ctx, parsed.ean, rawName, false);
    }

    const { data, error } = await ctx.db
      .from("delivery_lines")
      .insert({
        delivery_id: parsed.deliveryId,
        product_id: productId,
        raw_name: rawName,
        ean: parsed.ean,
        expected_qty: 0,
        scanned_qty: 1,
      })
      .select(
        "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        const line = await getDeliveryLineInOrg(ctx, parsed.deliveryId, parsed.ean);
        if (line) {
          return { success: true, line: DeliveryLineRowSchema.parse(line) };
        }
      }
      return { success: false, error: error.message };
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
      error instanceof Error ? error.message : "Erreur lors de l'ajout de ligne";
    return { success: false, error: message };
  }
}
