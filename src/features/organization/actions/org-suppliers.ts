"use server";

import {
  OrgContextError,
  requireOrgAdminContext,
} from "@/lib/organizations/org-context";

export type OrgSupplierListItem = {
  id: string;
  name: string;
  email: string | null;
  leadTimeDays: number;
};

export type GetOrgSuppliersResult =
  | { success: true; data: OrgSupplierListItem[] }
  | { success: false; error: string; code?: string };

export type UpdateSupplierLeadTimeResult =
  | { success: true; data: OrgSupplierListItem }
  | { success: false; error: string; code?: string };

export async function getOrgSuppliers(): Promise<GetOrgSuppliersResult> {
  try {
    const ctx = await requireOrgAdminContext();

    const { data, error } = await ctx.db
      .from("suppliers")
      .select("id, name, email, lead_time_days")
      .eq("organization_id", ctx.organizationId)
      .order("name", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data ?? []).map((row) => ({
        id: row.id as string,
        name: row.name as string,
        email: (row.email as string | null) ?? null,
        leadTimeDays: Number(row.lead_time_days ?? 0),
      })),
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors du chargement des fournisseurs" };
  }
}

export async function updateSupplierLeadTime(input: {
  supplierId: string;
  leadTimeDays: number;
}): Promise<UpdateSupplierLeadTimeResult> {
  try {
    const ctx = await requireOrgAdminContext();

    const leadTimeDays = Math.max(0, Math.floor(input.leadTimeDays));
    if (!Number.isFinite(leadTimeDays)) {
      return { success: false, error: "Délai invalide" };
    }

    const { data, error } = await ctx.db
      .from("suppliers")
      .update({ lead_time_days: leadTimeDays })
      .eq("id", input.supplierId)
      .eq("organization_id", ctx.organizationId)
      .select("id, name, email, lead_time_days")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: "Fournisseur introuvable" };
    }

    return {
      success: true,
      data: {
        id: data.id as string,
        name: data.name as string,
        email: (data.email as string | null) ?? null,
        leadTimeDays: Number(data.lead_time_days ?? 0),
      },
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}
