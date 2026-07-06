// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { revalidatePath } from "next/cache";

import { requireArtisanAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import type { ArtisanQuoteStatus } from "@/types/database.types";

export type ArtisanActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ArtisanContact = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
};

export type ContactInput = {
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
};

export type ContactQuote = {
  id: string;
  customerName: string | null;
  status: ArtisanQuoteStatus;
  grandTotalCents: number;
  createdAt: string;
};

export type ContactInvoice = {
  id: string;
  invoiceNumber: string | null;
  status: "draft" | "sent" | "paid";
  grandTotalCents: number;
  createdAt: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapContact(row: {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}): ArtisanContact {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/** Normalise et valide les champs d'un contact. */
function normalizeInput(input: ContactInput): { ok: true; value: ContactInput } | { ok: false; error: string } {
  const fullName = input.fullName.trim();
  if (!fullName) return { ok: false, error: "Le nom du contact est requis." };

  const email = input.email?.trim() || null;
  if (email && !EMAIL_RE.test(email)) return { ok: false, error: "L'adresse e-mail est invalide." };

  return {
    ok: true,
    value: {
      fullName,
      email,
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  };
}

export async function listContacts(): Promise<ArtisanActionResult<ArtisanContact[]>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data, error } = await db
      .from("artisan_contacts")
      .select("id, full_name, email, phone, company, address, notes, created_at")
      .eq("organization_id", access.organizationId)
      .order("full_name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []).map(mapContact) };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function getContact(contactId: string): Promise<
  ArtisanActionResult<{ contact: ArtisanContact; quotes: ContactQuote[]; invoices: ContactInvoice[] }>
> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;

    const { data: contact, error } = await db
      .from("artisan_contacts")
      .select("id, full_name, email, phone, company, address, notes, created_at")
      .eq("id", contactId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!contact) return { success: false, error: "Contact introuvable." };

    const [{ data: quotes }, { data: invoices }] = await Promise.all([
      db
        .from("artisan_quotes")
        .select("id, customer_name, status, grand_total, created_at")
        .eq("organization_id", orgId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false }),
      db
        .from("artisan_invoices")
        .select("id, invoice_number, status, grand_total, created_at")
        .eq("organization_id", orgId)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false }),
    ]);

    return {
      success: true,
      data: {
        contact: mapContact(contact),
        quotes: (quotes ?? []).map((q) => ({
          id: q.id as string,
          customerName: (q.customer_name as string | null) ?? null,
          status: q.status as ArtisanQuoteStatus,
          grandTotalCents: (q.grand_total as number) ?? 0,
          createdAt: q.created_at as string,
        })),
        invoices: (invoices ?? []).map((i) => ({
          id: i.id as string,
          invoiceNumber: (i.invoice_number as string | null) ?? null,
          status: i.status as "draft" | "sent" | "paid",
          grandTotalCents: (i.grand_total as number) ?? 0,
          createdAt: i.created_at as string,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function createContact(input: ContactInput): Promise<ArtisanActionResult<{ id: string }>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const norm = normalizeInput(input);
    if (!norm.ok) return { success: false, error: norm.error };

    const db = forWrite(await createServerSupabaseClient());
    const { data, error } = await db
      .from("artisan_contacts")
      .insert({
        organization_id: access.organizationId,
        full_name: norm.value.fullName,
        email: norm.value.email,
        phone: norm.value.phone,
        company: norm.value.company,
        address: norm.value.address,
        notes: norm.value.notes,
      })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Échec de création" };
    revalidatePath("/artisan/contacts");
    return { success: true, data: { id: data.id as string } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function updateContact(
  contactId: string,
  input: ContactInput
): Promise<ArtisanActionResult> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const norm = normalizeInput(input);
    if (!norm.ok) return { success: false, error: norm.error };

    const db = forWrite(await createServerSupabaseClient());
    const { error } = await db
      .from("artisan_contacts")
      .update({
        full_name: norm.value.fullName,
        email: norm.value.email,
        phone: norm.value.phone,
        company: norm.value.company,
        address: norm.value.address,
        notes: norm.value.notes,
      })
      .eq("id", contactId)
      .eq("organization_id", access.organizationId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/artisan/contacts");
    revalidatePath(`/artisan/contacts/${contactId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function deleteContact(contactId: string): Promise<ArtisanActionResult> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    // organization_id filtré en plus de la RLS (défense en profondeur).
    // Les devis/factures liés conservent leur historique (contact_id → NULL via FK).
    const { error } = await db
      .from("artisan_contacts")
      .delete()
      .eq("id", contactId)
      .eq("organization_id", access.organizationId);

    if (error) return { success: false, error: error.message };
    revalidatePath("/artisan/contacts");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
