// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireArtisanAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import type { QuoteDraft } from "@/features/artisan/quotes/schemas";
import type { ArtisanQuoteStatus } from "@/types/database.types";

export type QuoteListItem = {
  id: string;
  customerName: string | null;
  status: ArtisanQuoteStatus;
  grandTotalCents: number;
  createdAt: string;
};

export type QuoteServiceLine = {
  label: string;
  durationMinutes: number;
  unitPriceCents: number | null;
  lineTotalCents: number;
};

export type QuoteMaterialLine = {
  label: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type QuoteDetail = {
  id: string;
  businessName: string;
  customerName: string | null;
  customerEmail: string | null;
  status: ArtisanQuoteStatus;
  laborTotalCents: number;
  materialsTotalCents: number;
  grandTotalCents: number;
  notes: string | null;
  createdAt: string;
  services: QuoteServiceLine[];
  materials: QuoteMaterialLine[];
  invoiceId: string | null;
};

export type ArtisanActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

const toCents = (eur: number) => Math.round(eur * 100);

/**
 * Persiste un brouillon IA en devis (statut draft) avec ses lignes.
 * Les montants du brouillon sont en euros → convertis en centimes.
 */
export async function createQuoteFromDraft(
  draft: QuoteDraft,
  contactId?: string | null
): Promise<ArtisanActionResult<{ id: string }>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());

    // Contact rattaché : ses coordonnées priment sur le nom extrait par l'IA.
    let contactRef: string | null = null;
    let customerName: string | null = draft.customer_name;
    let customerEmail: string | null = null;
    if (contactId) {
      const { data: contact } = await db
        .from("artisan_contacts")
        .select("id, full_name, email")
        .eq("id", contactId)
        .eq("organization_id", access.organizationId)
        .maybeSingle();
      if (!contact) return { success: false, error: "Contact introuvable." };
      contactRef = contact.id as string;
      customerName = contact.full_name as string;
      customerEmail = (contact.email as string | null) ?? null;
    }

    const laborLines = draft.labor_items.map((l) => ({
      service_title: l.label,
      duration_minutes: Math.round(l.hours * 60),
      unit_price: toCents(l.hourly_rate_eur),
      line_total: toCents(l.hours * l.hourly_rate_eur),
    }));
    const materialLines = draft.materials.map((m) => ({
      label: m.label,
      quantity: Math.max(1, Math.round(m.quantity)),
      unit_price: toCents(m.unit_price_eur),
      line_total: toCents(m.quantity * m.unit_price_eur),
    }));

    const laborTotal = laborLines.reduce((s, l) => s + l.line_total, 0);
    const materialsTotal = materialLines.reduce((s, l) => s + l.line_total, 0);
    const laborMinutes = laborLines.reduce((s, l) => s + l.duration_minutes, 0);

    const { data: quote, error: quoteError } = await db
      .from("artisan_quotes")
      .insert({
        organization_id: access.organizationId,
        contact_id: contactRef,
        customer_name: customerName,
        customer_email: customerEmail,
        status: "draft",
        labor_duration_minutes: laborMinutes,
        labor_total: laborTotal,
        materials_total: materialsTotal,
        grand_total: laborTotal + materialsTotal,
        notes: draft.notes || null,
      })
      .select("id")
      .single();

    if (quoteError || !quote) {
      return { success: false, error: quoteError?.message ?? "Échec de création du devis" };
    }

    if (laborLines.length > 0) {
      const { error } = await db.from("artisan_quote_services").insert(
        laborLines.map((l) => ({ quote_id: quote.id, ...l }))
      );
      if (error) return { success: false, error: error.message };
    }
    if (materialLines.length > 0) {
      const { error } = await db.from("artisan_quote_materials").insert(
        materialLines.map((l) => ({ quote_id: quote.id, ...l }))
      );
      if (error) return { success: false, error: error.message };
    }

    return { success: true, data: { id: quote.id as string } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function listQuotes(): Promise<ArtisanActionResult<QuoteListItem[]>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data, error } = await db
      .from("artisan_quotes")
      .select("id, customer_name, status, grand_total, created_at")
      .eq("organization_id", access.organizationId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { success: false, error: error.message };

    const items: QuoteListItem[] = (data ?? []).map((q) => ({
      id: q.id as string,
      customerName: q.customer_name as string | null,
      status: q.status as ArtisanQuoteStatus,
      grandTotalCents: q.grand_total as number,
      createdAt: q.created_at as string,
    }));
    return { success: true, data: items };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

/** Détail d'un devis (en-tête + lignes), scopé à l'organisation. */
export async function getQuote(quoteId: string): Promise<ArtisanActionResult<QuoteDetail>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data: quote, error } = await db
      .from("artisan_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!quote) return { success: false, error: "Devis introuvable" };

    const [{ data: services }, { data: materials }, { data: invoice }, { data: profile }] =
      await Promise.all([
        db.from("artisan_quote_services").select("service_title, duration_minutes, unit_price, line_total").eq("quote_id", quoteId),
        db.from("artisan_quote_materials").select("label, quantity, unit_price, line_total").eq("quote_id", quoteId),
        db.from("artisan_invoices").select("id").eq("quote_id", quoteId).maybeSingle(),
        db.from("artisan_profiles").select("business_name").eq("organization_id", access.organizationId).maybeSingle(),
      ]);

    return {
      success: true,
      data: {
        id: quote.id as string,
        businessName: (profile?.business_name as string) ?? "",
        customerName: quote.customer_name as string | null,
        customerEmail: quote.customer_email as string | null,
        status: quote.status as ArtisanQuoteStatus,
        laborTotalCents: quote.labor_total as number,
        materialsTotalCents: quote.materials_total as number,
        grandTotalCents: quote.grand_total as number,
        notes: quote.notes as string | null,
        createdAt: quote.created_at as string,
        services: (services ?? []).map((s) => ({
          label: s.service_title as string,
          durationMinutes: (s.duration_minutes as number) ?? 0,
          unitPriceCents: (s.unit_price as number | null) ?? null,
          lineTotalCents: (s.line_total as number) ?? 0,
        })),
        materials: (materials ?? []).map((m) => ({
          label: m.label as string,
          quantity: (m.quantity as number) ?? 1,
          unitPriceCents: (m.unit_price as number) ?? 0,
          lineTotalCents: (m.line_total as number) ?? 0,
        })),
        invoiceId: (invoice?.id as string | undefined) ?? null,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

const ALLOWED_STATUSES: ArtisanQuoteStatus[] = ["draft", "sent", "accepted", "rejected"];

/** Change le statut d'un devis (brouillon → envoyé → accepté/refusé). */
export async function updateQuoteStatus(
  quoteId: string,
  status: ArtisanQuoteStatus
): Promise<ArtisanActionResult> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };
    if (!ALLOWED_STATUSES.includes(status)) return { success: false, error: "Statut invalide" };

    const db = forWrite(await createServerSupabaseClient());
    const patch: Record<string, unknown> = { status };
    if (status === "accepted") patch.signed_at = new Date().toISOString();
    if (status === "rejected") patch.rejected_at = new Date().toISOString();

    const { error } = await db
      .from("artisan_quotes")
      .update(patch)
      .eq("id", quoteId)
      .eq("organization_id", access.organizationId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

/** Convertit un devis en facture (une seule facture par devis). */
export async function convertQuoteToInvoice(
  quoteId: string
): Promise<ArtisanActionResult<{ invoiceId: string }>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());

    const { data: quote, error: quoteError } = await db
      .from("artisan_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();
    if (quoteError) return { success: false, error: quoteError.message };
    if (!quote) return { success: false, error: "Devis introuvable" };

    const { data: existing } = await db
      .from("artisan_invoices")
      .select("id")
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (existing) return { success: true, data: { invoiceId: existing.id as string } };

    // Numéro de facture séquentiel atomique par organisation (F-AAAA-NNN).
    const year = new Date().getFullYear();
    const { data: seq } = await db.rpc("next_counter", {
      p_org: access.organizationId,
      p_scope: "artisan_invoice",
    });
    const invoiceNumber = `F-${year}-${String((seq as number) ?? 1).padStart(3, "0")}`;

    const { data: invoice, error: invError } = await db
      .from("artisan_invoices")
      .insert({
        organization_id: access.organizationId,
        quote_id: quoteId,
        contact_id: (quote.contact_id as string | null) ?? null,
        customer_name: quote.customer_name as string | null,
        customer_email: quote.customer_email as string | null,
        invoice_number: invoiceNumber,
        status: "draft",
        labor_total: quote.labor_total as number,
        materials_total: quote.materials_total as number,
        grand_total: quote.grand_total as number,
        notes: quote.notes as string | null,
      })
      .select("id")
      .single();
    if (invError || !invoice) return { success: false, error: invError?.message ?? "Échec de création" };

    // Copie des lignes du devis vers la facture.
    const [{ data: services }, { data: materials }] = await Promise.all([
      db.from("artisan_quote_services").select("service_title, line_total").eq("quote_id", quoteId),
      db.from("artisan_quote_materials").select("label, quantity, unit_price, line_total").eq("quote_id", quoteId),
    ]);

    const lines = [
      ...(services ?? []).map((s, i) => ({
        invoice_id: invoice.id as string,
        line_kind: "service" as const,
        label: s.service_title as string,
        line_total: (s.line_total as number) ?? 0,
        sort_order: i,
      })),
      ...(materials ?? []).map((m, i) => ({
        invoice_id: invoice.id as string,
        line_kind: "material" as const,
        label: m.label as string,
        quantity: m.quantity as number,
        unit_price: m.unit_price as number,
        line_total: m.line_total as number,
        sort_order: 100 + i,
      })),
    ];
    if (lines.length > 0) {
      const { error: linesError } = await db.from("artisan_invoice_lines").insert(lines);
      if (linesError) return { success: false, error: linesError.message };
    }

    // Le devis passe en « accepté » (converti en facture).
    await db
      .from("artisan_quotes")
      .update({ status: "accepted", signed_at: new Date().toISOString() })
      .eq("id", quoteId)
      .eq("organization_id", access.organizationId);

    return { success: true, data: { invoiceId: invoice.id as string } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export type QuoteContentInput = {
  customerName: string | null;
  notes: string | null;
  labor: { label: string; hours: number; hourlyRateEur: number }[];
  materials: { label: string; quantity: number; unitPriceEur: number }[];
};

/**
 * Remplace le contenu d'un devis (lignes + client + notes) et recalcule les
 * totaux côté serveur. Autorisé uniquement tant que le devis est en brouillon.
 */
export async function updateQuoteContent(
  quoteId: string,
  input: QuoteContentInput
): Promise<ArtisanActionResult> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());

    const { data: quote } = await db
      .from("artisan_quotes")
      .select("status")
      .eq("id", quoteId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();
    if (!quote) return { success: false, error: "Devis introuvable" };
    if ((quote.status as ArtisanQuoteStatus) !== "draft") {
      return { success: false, error: "Seul un devis en brouillon peut être modifié." };
    }

    const laborLines = input.labor
      .filter((l) => l.label.trim())
      .map((l) => ({
        service_title: l.label.trim(),
        duration_minutes: Math.max(0, Math.round(l.hours * 60)),
        unit_price: toCents(l.hourlyRateEur),
        line_total: toCents(l.hours * l.hourlyRateEur),
      }));
    const materialLines = input.materials
      .filter((m) => m.label.trim())
      .map((m) => ({
        label: m.label.trim(),
        quantity: Math.max(1, Math.round(m.quantity)),
        unit_price: toCents(m.unitPriceEur),
        line_total: toCents(m.quantity * m.unitPriceEur),
      }));

    const laborTotal = laborLines.reduce((s, l) => s + l.line_total, 0);
    const materialsTotal = materialLines.reduce((s, l) => s + l.line_total, 0);
    const laborMinutes = laborLines.reduce((s, l) => s + l.duration_minutes, 0);

    // Remplace les lignes (delete puis insert).
    await db.from("artisan_quote_services").delete().eq("quote_id", quoteId);
    await db.from("artisan_quote_materials").delete().eq("quote_id", quoteId);

    if (laborLines.length > 0) {
      const { error } = await db
        .from("artisan_quote_services")
        .insert(laborLines.map((l) => ({ quote_id: quoteId, ...l })));
      if (error) return { success: false, error: error.message };
    }
    if (materialLines.length > 0) {
      const { error } = await db
        .from("artisan_quote_materials")
        .insert(materialLines.map((l) => ({ quote_id: quoteId, ...l })));
      if (error) return { success: false, error: error.message };
    }

    const { error: headerError } = await db
      .from("artisan_quotes")
      .update({
        customer_name: input.customerName?.trim() || null,
        notes: input.notes?.trim() || null,
        labor_duration_minutes: laborMinutes,
        labor_total: laborTotal,
        materials_total: materialsTotal,
        grand_total: laborTotal + materialsTotal,
      })
      .eq("id", quoteId)
      .eq("organization_id", access.organizationId);
    if (headerError) return { success: false, error: headerError.message };

    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
