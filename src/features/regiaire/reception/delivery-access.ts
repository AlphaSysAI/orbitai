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
