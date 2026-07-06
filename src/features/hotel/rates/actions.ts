// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireHotelAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import type { HotelBoard } from "@/types/database.types";

export type HotelActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type RatePlan = {
  id: string;
  code: string;
  nom: string;
  roomTypeId: string | null;
  roomTypeName: string | null;
  board: HotelBoard;
  refundable: boolean;
  isActive: boolean;
};

const BOARDS: HotelBoard[] = ["RO", "BB", "HB", "FB"];

export async function listRatePlans(): Promise<HotelActionResult<RatePlan[]>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const [{ data: plans, error }, { data: types }] = await Promise.all([
      db
        .from("hotel_rate_plans")
        .select("id, code, nom, room_type_id, board, refundable, is_active")
        .eq("organization_id", access.organizationId)
        .order("code", { ascending: true }),
      db.from("hotel_room_types").select("id, nom").eq("organization_id", access.organizationId),
    ]);
    if (error) return { success: false, error: error.message };

    const typeName = new Map((types ?? []).map((t) => [t.id as string, t.nom as string]));
    return {
      success: true,
      data: (plans ?? []).map((p) => ({
        id: p.id as string,
        code: p.code as string,
        nom: p.nom as string,
        roomTypeId: p.room_type_id as string | null,
        roomTypeName: p.room_type_id ? typeName.get(p.room_type_id as string) ?? "—" : null,
        board: p.board as HotelBoard,
        refundable: p.refundable as boolean,
        isActive: p.is_active as boolean,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export type RateDay = {
  date: string;
  priceCents: number;
  minStay: number;
  closed: boolean;
  hasRow: boolean; // false = valeur par défaut du type (pas de ligne calendrier)
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Grille tarifaire d'un plan × type sur une plage (avec repli sur le tarif par défaut). */
export async function getRateCalendar(
  ratePlanId: string,
  roomTypeId: string,
  from: string,
  to: string
): Promise<HotelActionResult<{ days: RateDay[]; defaultRateCents: number }>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) return { success: false, error: "Dates invalides." };

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;

    const [{ data: type }, { data: rows }] = await Promise.all([
      db.from("hotel_room_types").select("default_rate_cents").eq("id", roomTypeId).eq("organization_id", orgId).maybeSingle(),
      db
        .from("hotel_rate_calendar")
        .select("date, price_cents, min_stay, closed")
        .eq("organization_id", orgId)
        .eq("rate_plan_id", ratePlanId)
        .eq("room_type_id", roomTypeId)
        .gte("date", from)
        .lte("date", to),
    ]);
    const defaultRate = (type?.default_rate_cents as number) ?? 0;
    const byDate = new Map(
      (rows ?? []).map((r) => [r.date as string, r])
    );

    const days: RateDay[] = [];
    const cur = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cur <= end) {
      const iso = cur.toISOString().slice(0, 10);
      const row = byDate.get(iso);
      days.push({
        date: iso,
        priceCents: row ? (row.price_cents as number) : defaultRate,
        minStay: row ? (row.min_stay as number) : 1,
        closed: row ? (row.closed as boolean) : false,
        hasRow: Boolean(row),
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return { success: true, data: { days, defaultRateCents: defaultRate } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

/** Applique un prix / min. nuits / fermeture à un ensemble de dates (upsert). */
export async function setRateCalendar(input: {
  ratePlanId: string;
  roomTypeId: string;
  dates: string[];
  priceEur?: number | null;
  minStay?: number | null;
  closed?: boolean | null;
}): Promise<HotelActionResult> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const dates = input.dates.filter((d) => DATE_RE.test(d));
    if (dates.length === 0) return { success: false, error: "Aucune date." };

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;

    // Vérifie que plan et type appartiennent à l'org (défense en profondeur).
    const [{ data: plan }, { data: type }] = await Promise.all([
      db.from("hotel_rate_plans").select("id").eq("id", input.ratePlanId).eq("organization_id", orgId).maybeSingle(),
      db.from("hotel_room_types").select("default_rate_cents").eq("id", input.roomTypeId).eq("organization_id", orgId).maybeSingle(),
    ]);
    if (!plan || !type) return { success: false, error: "Plan ou type invalide." };

    const priceCents =
      input.priceEur === null || input.priceEur === undefined
        ? (type.default_rate_cents as number)
        : Math.max(0, Math.round(input.priceEur * 100));

    const rows = dates.map((date) => ({
      organization_id: orgId,
      rate_plan_id: input.ratePlanId,
      room_type_id: input.roomTypeId,
      date,
      price_cents: priceCents,
      min_stay: input.minStay && input.minStay > 0 ? Math.round(input.minStay) : 1,
      closed: input.closed ?? false,
    }));

    const { error } = await db
      .from("hotel_rate_calendar")
      .upsert(rows, { onConflict: "rate_plan_id,room_type_id,date" });
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function createRatePlan(input: {
  code: string;
  nom: string;
  roomTypeId: string | null;
  board: HotelBoard;
  refundable: boolean;
}): Promise<HotelActionResult<{ id: string }>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const code = input.code.trim();
    const nom = input.nom.trim();
    if (!code || !nom) return { success: false, error: "Code et nom requis." };
    if (!BOARDS.includes(input.board)) return { success: false, error: "Formule invalide." };

    const db = forWrite(await createServerSupabaseClient());

    // Si un type est précisé, vérifie qu'il appartient à l'organisation.
    if (input.roomTypeId) {
      const { data: type } = await db
        .from("hotel_room_types")
        .select("id")
        .eq("id", input.roomTypeId)
        .eq("organization_id", access.organizationId)
        .maybeSingle();
      if (!type) return { success: false, error: "Type de chambre invalide." };
    }

    const { data, error } = await db
      .from("hotel_rate_plans")
      .insert({
        organization_id: access.organizationId,
        code,
        nom,
        room_type_id: input.roomTypeId,
        board: input.board,
        refundable: input.refundable,
      })
      .select("id")
      .single();
    if (error || !data) {
      const msg = error?.message.includes("duplicate") ? "Ce code existe déjà." : error?.message;
      return { success: false, error: msg ?? "Échec de création" };
    }
    return { success: true, data: { id: data.id as string } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
