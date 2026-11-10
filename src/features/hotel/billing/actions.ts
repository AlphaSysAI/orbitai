// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireHotelAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";

export type HotelActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type CityTaxConfig = {
  enabled: boolean;
  amountPerPersonNightCents: number;
  exemptChildren: boolean;
  maxNights: number | null;
};

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string | null;
  customerName: string | null;
  status: "draft" | "sent" | "paid";
  totalCents: number;
  createdAt: string;
};

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

export async function getCityTaxConfig(): Promise<HotelActionResult<CityTaxConfig>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data } = await db
      .from("hotel_city_tax_config")
      .select("enabled, amount_cents_per_person_night, exempt_children, max_nights")
      .eq("organization_id", access.organizationId)
      .maybeSingle();

    return {
      success: true,
      data: {
        enabled: (data?.enabled as boolean) ?? false,
        amountPerPersonNightCents: (data?.amount_cents_per_person_night as number) ?? 0,
        exemptChildren: (data?.exempt_children as boolean) ?? true,
        maxNights: (data?.max_nights as number | null) ?? null,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function updateCityTaxConfig(input: {
  enabled: boolean;
  amountPerPersonNightEur: number;
  exemptChildren: boolean;
  maxNights: number | null;
}): Promise<HotelActionResult> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { error } = await db.from("hotel_city_tax_config").upsert(
      {
        organization_id: access.organizationId,
        enabled: input.enabled,
        amount_cents_per_person_night: Math.max(0, Math.round(input.amountPerPersonNightEur * 100)),
        exempt_children: input.exemptChildren,
        max_nights: input.maxNights && input.maxNights > 0 ? Math.round(input.maxNights) : null,
      },
      { onConflict: "organization_id" }
    );
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function generateInvoice(
  reservationId: string
): Promise<HotelActionResult<{ id: string }>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;

    const { data: res } = await db
      .from("hotel_reservations")
      .select("id, reference, customer_name, customer_email, check_in, check_out, adults, children, total_cents")
      .eq("id", reservationId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!res) return { success: false, error: "Réservation introuvable" };

    const { data: existing } = await db
      .from("hotel_invoices")
      .select("id")
      .eq("reservation_id", reservationId)
      .maybeSingle();
    if (existing) return { success: true, data: { id: existing.id as string } };

    // Lignes = une par chambre (somme de ses nuits).
    const [{ data: rrooms }, { data: types }, { data: nights }, { data: cfg }] = await Promise.all([
      db.from("hotel_reservation_rooms").select("id, room_type_id").eq("reservation_id", reservationId),
      db.from("hotel_room_types").select("id, nom").eq("organization_id", orgId),
      db
        .from("hotel_reservation_nights")
        .select("reservation_room_id, price_snapshot_cents")
        .eq("organization_id", orgId),
      db
        .from("hotel_city_tax_config")
        .select("enabled, amount_cents_per_person_night, exempt_children, max_nights")
        .eq("organization_id", orgId)
        .maybeSingle(),
    ]);

    const typeName = new Map((types ?? []).map((t) => [t.id as string, t.nom as string]));
    const roomIds = new Set((rrooms ?? []).map((r) => r.id as string));
    const perRoom = new Map<string, number>();
    for (const n of nights ?? []) {
      const rid = n.reservation_room_id as string;
      if (!roomIds.has(rid)) continue;
      perRoom.set(rid, (perRoom.get(rid) ?? 0) + (n.price_snapshot_cents as number));
    }

    const nightsCount = nightsBetween(res.check_in as string, res.check_out as string);
    const lines = (rrooms ?? []).map((r, i) => ({
      label: `${typeName.get(r.room_type_id as string) ?? "Chambre"} — ${nightsCount} nuit${nightsCount > 1 ? "s" : ""}`,
      amount_cents: perRoom.get(r.id as string) ?? 0,
      sort_order: i,
    }));
    const subtotal = lines.reduce((s, l) => s + l.amount_cents, 0);

    // Taxe de séjour (forfait par personne et par nuit).
    let cityTax = 0;
    if (cfg?.enabled) {
      const persons = (res.adults as number) + (cfg.exempt_children ? 0 : (res.children as number));
      const taxableNights = cfg.max_nights ? Math.min(nightsCount, cfg.max_nights as number) : nightsCount;
      cityTax = taxableNights * persons * (cfg.amount_cents_per_person_night as number);
    }
    if (cityTax > 0) {
      lines.push({ label: "Taxe de séjour", amount_cents: cityTax, sort_order: 900 });
    }

    const year = new Date().getFullYear();
    const { data: seq } = await db.rpc("next_counter", { p_org: orgId, p_scope: "hotel_invoice" });
    const invoiceNumber = `F-${year}-${String((seq as number) ?? 1).padStart(4, "0")}`;

    const { data: invoice, error: invError } = await db
      .from("hotel_invoices")
      .insert({
        organization_id: orgId,
        reservation_id: reservationId,
        invoice_number: invoiceNumber,
        customer_name: res.customer_name as string | null,
        customer_email: res.customer_email as string | null,
        subtotal_cents: subtotal,
        city_tax_cents: cityTax,
        total_cents: subtotal + cityTax,
        status: "draft",
      })
      .select("id")
      .single();
    if (invError || !invoice) return { success: false, error: invError?.message ?? "Échec de création" };

    if (lines.length > 0) {
      const { error: linesError } = await db
        .from("hotel_invoice_lines")
        .insert(lines.map((l) => ({ invoice_id: invoice.id as string, ...l })));
      if (linesError) return { success: false, error: linesError.message };
    }

    return { success: true, data: { id: invoice.id as string } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function listInvoices(): Promise<HotelActionResult<InvoiceListItem[]>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data, error } = await db
      .from("hotel_invoices")
      .select("id, invoice_number, customer_name, status, total_cents, created_at")
      .eq("organization_id", access.organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: (data ?? []).map((i) => ({
        id: i.id as string,
        invoiceNumber: i.invoice_number as string | null,
        customerName: i.customer_name as string | null,
        status: i.status as "draft" | "sent" | "paid",
        totalCents: i.total_cents as number,
        createdAt: i.created_at as string,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
