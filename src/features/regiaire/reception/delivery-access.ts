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

export type ProductRow = {
  id: string;
  organization_id: string;
  ean: string;
  name: string;
  has_dlc: boolean;
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

export async function getProductByEanInOrg(
  ctx: RegiaireContext,
  ean: string
): Promise<ProductRow | null> {
  const { data, error } = await ctx.db
    .from("products")
    .select("id, organization_id, ean, name, has_dlc")
    .eq("organization_id", ctx.organizationId)
    .eq("ean", ean)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProductRow;
}

export async function getProductByIdInOrg(
  ctx: RegiaireContext,
  productId: string
): Promise<ProductRow | null> {
  const { data, error } = await ctx.db
    .from("products")
    .select("id, organization_id, ean, name, has_dlc")
    .eq("organization_id", ctx.organizationId)
    .eq("id", productId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProductRow;
}

const DELIVERY_LINE_SELECT =
  "id, delivery_id, product_id, raw_name, ean, expected_qty, scanned_qty, dlc, needs_review";

/** Ligne BL appartenant à une livraison de l'org courante. */
export async function getDeliveryLineInOrg(
  ctx: RegiaireContext,
  deliveryId: string,
  ean: string
): Promise<{
  id: string;
  delivery_id: string;
  product_id: string | null;
  raw_name: string;
  ean: string | null;
  expected_qty: number;
  scanned_qty: number;
  dlc: string | null;
  needs_review: boolean;
} | null> {
  const delivery = await getDeliveryInOrg(ctx, deliveryId);
  if (!delivery) return null;

  const { data, error } = await ctx.db
    .from("delivery_lines")
    .select(DELIVERY_LINE_SELECT)
    .eq("delivery_id", deliveryId)
    .eq("ean", ean)
    .maybeSingle();

  if (error || !data) return null;

  return data as {
    id: string;
    delivery_id: string;
    product_id: string | null;
    raw_name: string;
    ean: string | null;
    expected_qty: number;
    scanned_qty: number;
    dlc: string | null;
    needs_review: boolean;
  };
}

export async function getDeliveryLineByIdInOrg(
  ctx: RegiaireContext,
  deliveryId: string,
  lineId: string
): Promise<{
  id: string;
  delivery_id: string;
  product_id: string | null;
  raw_name: string;
  ean: string | null;
  expected_qty: number;
  scanned_qty: number;
  dlc: string | null;
  needs_review: boolean;
} | null> {
  const delivery = await getDeliveryInOrg(ctx, deliveryId);
  if (!delivery) return null;

  const { data, error } = await ctx.db
    .from("delivery_lines")
    .select(DELIVERY_LINE_SELECT)
    .eq("delivery_id", deliveryId)
    .eq("id", lineId)
    .maybeSingle();

  if (error || !data) return null;

  return data as {
    id: string;
    delivery_id: string;
    product_id: string | null;
    raw_name: string;
    ean: string | null;
    expected_qty: number;
    scanned_qty: number;
    dlc: string | null;
    needs_review: boolean;
  };
}

/** Fusionne les lignes normalisées : par EAN si connu, sinon une entrée par ligne. */
export function aggregateBlLines(
  lines: Array<{
    raw_name: string;
    ean: string | null;
    expected_qty: number;
    dlc: string | null;
    needs_review: boolean;
  }>
): Array<{
  raw_name: string;
  ean: string | null;
  expected_qty: number;
  dlc: string | null;
  needs_review: boolean;
}> {
  const byEan = new Map<
    string,
    {
      raw_name: string;
      expected_qty: number;
      dlc: string | null;
      needs_review: boolean;
    }
  >();
  const instanceLines: typeof lines = [];

  for (const line of lines) {
    if (!line.ean) {
      instanceLines.push(line);
      continue;
    }

    const existing = byEan.get(line.ean);
    if (existing) {
      existing.expected_qty += line.expected_qty;
      if (line.dlc && !existing.dlc) {
        existing.dlc = line.dlc;
      }
      existing.needs_review = existing.needs_review || line.needs_review;
    } else {
      byEan.set(line.ean, {
        raw_name: line.raw_name,
        expected_qty: line.expected_qty,
        dlc: line.dlc,
        needs_review: line.needs_review,
      });
    }
  }

  const merged = Array.from(byEan.entries()).map(([ean, value]) => ({
    ean,
    raw_name: value.raw_name,
    expected_qty: value.expected_qty,
    dlc: value.dlc,
    needs_review: value.needs_review,
  }));

  return [...merged, ...instanceLines];
}

/** @deprecated Utiliser aggregateBlLines */
export function aggregateBlLinesByEan(
  lines: Array<{ ean: string; name: string; expected_qty: number; dlc: string | null }>
): Array<{ ean: string; name: string; expected_qty: number; dlc: string | null }> {
  const byEan = new Map<
    string,
    { name: string; expected_qty: number; dlc: string | null }
  >();

  for (const line of lines) {
    const existing = byEan.get(line.ean);
    if (existing) {
      existing.expected_qty += line.expected_qty;
      if (line.dlc && !existing.dlc) {
        existing.dlc = line.dlc;
      }
    } else {
      byEan.set(line.ean, {
        name: line.name,
        expected_qty: line.expected_qty,
        dlc: line.dlc,
      });
    }
  }

  return Array.from(byEan.entries()).map(([ean, value]) => ({
    ean,
    ...value,
  }));
}
