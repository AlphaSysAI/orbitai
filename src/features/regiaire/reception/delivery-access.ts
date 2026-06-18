import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import type { DeliveryStatus } from "@/features/regiaire/reception/schemas";

export type DeliveryRow = {
  id: string;
  organization_id: string;
  supplier_id: string;
  status: DeliveryStatus;
  bl_file_path: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
};

export type SupplierRow = {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
};

export async function getDeliveryInOrg(
  ctx: RegiaireContext,
  deliveryId: string
): Promise<DeliveryRow | null> {
  const { data, error } = await ctx.db
    .from("deliveries")
    .select(
      "id, organization_id, supplier_id, status, bl_file_path, created_by, created_at, completed_at"
    )
    .eq("id", deliveryId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as DeliveryRow;
}

export async function getSupplierInOrg(
  ctx: RegiaireContext,
  supplierId: string
): Promise<SupplierRow | null> {
  const { data, error } = await ctx.db
    .from("suppliers")
    .select("id, organization_id, name, email")
    .eq("id", supplierId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (error || !data) return null;
  return data as SupplierRow;
}

export async function upsertProductForLine(
  ctx: RegiaireContext,
  ean: string,
  name: string,
  hasDlc: boolean
): Promise<string> {
  const { data, error } = await ctx.db
    .from("products")
    .upsert(
      {
        organization_id: ctx.organizationId,
        ean,
        name,
        has_dlc: hasDlc,
      },
      { onConflict: "organization_id,ean" }
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de créer le produit");
  }

  return (data as { id: string }).id;
}

const DELIVERY_LINE_SELECT =
  "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc";

/** Ligne BL appartenant à une livraison de l'org courante (ownership via join deliveries). */
export async function getDeliveryLineInOrg(
  ctx: RegiaireContext,
  deliveryId: string,
  ean: string
): Promise<{
  id: string;
  delivery_id: string;
  product_id: string | null;
  raw_name: string;
  ean: string;
  expected_qty: number;
  scanned_qty: number;
  dlc: string | null;
} | null> {
  const { data, error } = await ctx.db
    .from("delivery_lines")
    .select(DELIVERY_LINE_SELECT)
    .eq("delivery_id", deliveryId)
    .eq("ean", ean)
    .maybeSingle();

  if (error || !data) return null;

  const delivery = await getDeliveryInOrg(ctx, deliveryId);
  if (!delivery) return null;

  return data as {
    id: string;
    delivery_id: string;
    product_id: string | null;
    raw_name: string;
    ean: string;
    expected_qty: number;
    scanned_qty: number;
    dlc: string | null;
  };
}

/**
 * EAN absent du BL : produit créé au scan (pas à l'analyse), ligne ad hoc expected_qty=0.
 * Le premier incrément utilise allow_extra=true (RPC : 0 < 0 est faux).
 */
export async function createAdHocScanLine(
  ctx: RegiaireContext,
  deliveryId: string,
  ean: string,
  dlc?: string
): Promise<{
  id: string;
  delivery_id: string;
  product_id: string | null;
  raw_name: string;
  ean: string;
  expected_qty: number;
  scanned_qty: number;
  dlc: string | null;
}> {
  const productId = await upsertProductForLine(
    ctx,
    ean,
    `Produit ${ean}`,
    Boolean(dlc)
  );

  const { data, error } = await ctx.db
    .from("delivery_lines")
    .insert({
      delivery_id: deliveryId,
      product_id: productId,
      raw_name: `Produit ${ean}`,
      ean,
      expected_qty: 0,
      scanned_qty: 0,
      dlc: dlc ?? null,
    })
    .select(DELIVERY_LINE_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Impossible de créer la ligne de scan");
  }

  return data as {
    id: string;
    delivery_id: string;
    product_id: string | null;
    raw_name: string;
    ean: string;
    expected_qty: number;
    scanned_qty: number;
    dlc: string | null;
  };
}
