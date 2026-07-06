// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireArtisanAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";

export type ArtisanActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type InvoiceStatus = "draft" | "sent" | "paid";

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string | null;
  customerName: string | null;
  status: InvoiceStatus;
  grandTotalCents: number;
  createdAt: string;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string | null;
  businessName: string;
  customerName: string | null;
  customerEmail: string | null;
  laborTotalCents: number;
  materialsTotalCents: number;
  grandTotalCents: number;
  notes: string | null;
  createdAt: string;
  labor: { label: string; totalCents: number }[];
  materials: { label: string; totalCents: number }[];
};

export async function getInvoice(invoiceId: string): Promise<ArtisanActionResult<InvoiceDetail>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data: invoice, error } = await db
      .from("artisan_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!invoice) return { success: false, error: "Facture introuvable" };

    const [{ data: lines }, { data: profile }] = await Promise.all([
      db.from("artisan_invoice_lines").select("line_kind, label, line_total").eq("invoice_id", invoiceId).order("sort_order"),
      db.from("artisan_profiles").select("business_name").eq("organization_id", access.organizationId).maybeSingle(),
    ]);

    const all = (lines ?? []).map((l) => ({
      kind: l.line_kind as string,
      label: l.label as string,
      totalCents: (l.line_total as number) ?? 0,
    }));

    return {
      success: true,
      data: {
        id: invoice.id as string,
        invoiceNumber: invoice.invoice_number as string | null,
        businessName: (profile?.business_name as string) ?? "",
        customerName: invoice.customer_name as string | null,
        customerEmail: invoice.customer_email as string | null,
        laborTotalCents: invoice.labor_total as number,
        materialsTotalCents: invoice.materials_total as number,
        grandTotalCents: invoice.grand_total as number,
        notes: invoice.notes as string | null,
        createdAt: invoice.created_at as string,
        labor: all.filter((l) => l.kind !== "material").map((l) => ({ label: l.label, totalCents: l.totalCents })),
        materials: all.filter((l) => l.kind === "material").map((l) => ({ label: l.label, totalCents: l.totalCents })),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function listInvoices(): Promise<ArtisanActionResult<InvoiceListItem[]>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data, error } = await db
      .from("artisan_invoices")
      .select("id, invoice_number, customer_name, status, grand_total, created_at")
      .eq("organization_id", access.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return { success: false, error: error.message };

    const items: InvoiceListItem[] = (data ?? []).map((i) => ({
      id: i.id as string,
      invoiceNumber: i.invoice_number as string | null,
      customerName: i.customer_name as string | null,
      status: i.status as InvoiceStatus,
      grandTotalCents: i.grand_total as number,
      createdAt: i.created_at as string,
    }));
    return { success: true, data: items };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

/** Change le statut d'une facture (brouillon → envoyée → payée). */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus
): Promise<ArtisanActionResult> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };
    if (!["draft", "sent", "paid"].includes(status)) {
      return { success: false, error: "Statut invalide" };
    }

    const db = forWrite(await createServerSupabaseClient());
    const { error } = await db
      .from("artisan_invoices")
      .update({ status })
      .eq("id", invoiceId)
      .eq("organization_id", access.organizationId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
