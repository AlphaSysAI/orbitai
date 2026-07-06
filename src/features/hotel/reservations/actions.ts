// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireHotelAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import type {
  HotelPaymentKind,
  HotelPaymentMethod,
  HotelReservationStatus,
} from "@/types/database.types";

export type HotelActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ReservationRoomInput = {
  roomTypeId: string;
  ratePlanId: string;
  guestName?: string | null;
  occupants?: number;
};

export type ReservationListItem = {
  id: string;
  reference: string;
  customerName: string | null;
  status: HotelReservationStatus;
  checkIn: string;
  checkOut: string;
  totalCents: number;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Nuits [check_in, check_out) au format ISO date. */
function enumerateNights(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  const cur = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (cur < end) {
    nights.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return nights;
}

export async function createReservation(input: {
  customerName: string | null;
  customerEmail: string | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  status?: HotelReservationStatus;
  rooms: ReservationRoomInput[];
}): Promise<HotelActionResult<{ id: string; reference: string }>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    if (!DATE_RE.test(input.checkIn) || !DATE_RE.test(input.checkOut)) {
      return { success: false, error: "Dates invalides." };
    }
    if (input.checkOut <= input.checkIn) {
      return { success: false, error: "La date de départ doit suivre l'arrivée." };
    }
    if (!input.rooms.length) return { success: false, error: "Ajoutez au moins une chambre." };

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;
    const nights = enumerateNights(input.checkIn, input.checkOut);

    // Valide types + plans (appartenance à l'org) et récupère les tarifs par défaut.
    const [{ data: types }, { data: plans }, { data: rateRows }] = await Promise.all([
      db.from("hotel_room_types").select("id, default_rate_cents").eq("organization_id", orgId),
      db.from("hotel_rate_plans").select("id").eq("organization_id", orgId),
      db
        .from("hotel_rate_calendar")
        .select("rate_plan_id, room_type_id, date, price_cents")
        .eq("organization_id", orgId)
        .gte("date", input.checkIn)
        .lt("date", input.checkOut),
    ]);
    const typeDefault = new Map((types ?? []).map((t) => [t.id as string, t.default_rate_cents as number]));
    const planIds = new Set((plans ?? []).map((p) => p.id as string));
    const rateMap = new Map(
      (rateRows ?? []).map((r) => [`${r.rate_plan_id}|${r.room_type_id}|${r.date}`, r.price_cents as number])
    );

    for (const room of input.rooms) {
      if (!typeDefault.has(room.roomTypeId)) return { success: false, error: "Type de chambre invalide." };
      if (!planIds.has(room.ratePlanId)) return { success: false, error: "Plan tarifaire invalide." };
    }

    // Calcul des prix par chambre/nuit.
    const roomsComputed = input.rooms.map((room) => {
      const nightPrices = nights.map((date) => {
        const key = `${room.ratePlanId}|${room.roomTypeId}|${date}`;
        return rateMap.get(key) ?? typeDefault.get(room.roomTypeId) ?? 0;
      });
      const roomTotal = nightPrices.reduce((s, p) => s + p, 0);
      return { room, nightPrices, roomTotal };
    });
    // Booking ATOMIQUE via RPC (inventaire + dossier + chambres + nuits + folio
    // dans une seule transaction ; référence via compteur atomique). Aucun
    // dossier orphelin, aucun inventaire décrémenté en cas d'échec (rollback).
    const payload = {
      customer_name: input.customerName?.trim() || null,
      customer_email: input.customerEmail?.trim() || null,
      status: input.status ?? "confirmed",
      check_in: input.checkIn,
      check_out: input.checkOut,
      adults: Math.max(0, Math.round(input.adults)),
      children: Math.max(0, Math.round(input.children)),
      rooms: roomsComputed.map((rc) => ({
        room_type_id: rc.room.roomTypeId,
        rate_plan_id: rc.room.ratePlanId,
        guest_name: rc.room.guestName?.trim() || null,
        occupants: Math.max(1, Math.round(rc.room.occupants ?? input.adults ?? 1)),
        night_prices: rc.nightPrices,
      })),
    };

    const { data, error: rpcError } = await db.rpc("hotel_create_reservation", {
      p_org: orgId,
      p_payload: payload,
    });
    if (rpcError) {
      const m = rpcError.message;
      if (m.includes("no_inventory")) return { success: false, error: "Plus de disponibilité pour ces dates." };
      if (m.includes("invalid_room_type")) return { success: false, error: "Type de chambre invalide." };
      if (m.includes("invalid_rate_plan")) return { success: false, error: "Plan tarifaire invalide." };
      if (m.includes("invalid_dates")) return { success: false, error: "Dates invalides." };
      return { success: false, error: m };
    }

    const result = data as { id: string; reference: string };
    return { success: true, data: { id: result.id, reference: result.reference } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export type ReservationRoomDetail = {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  ratePlanName: string;
  roomId: string | null;
  roomNumber: string | null;
  guestName: string | null;
  status: HotelReservationStatus;
};

export type ReservationDetail = {
  id: string;
  reference: string;
  customerName: string | null;
  customerEmail: string | null;
  status: HotelReservationStatus;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalCents: number;
  balanceCents: number;
  paidCents: number;
  notes: string | null;
  rooms: ReservationRoomDetail[];
  // Chambres physiques actives par type (pour l'assignation).
  roomsByType: Record<string, { id: string; numero: string }[]>;
  payments: {
    id: string;
    method: HotelPaymentMethod;
    kind: HotelPaymentKind;
    amountCents: number;
    note: string | null;
    createdAt: string;
  }[];
};

export async function getReservation(
  reservationId: string
): Promise<HotelActionResult<ReservationDetail>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;

    const { data: res, error } = await db
      .from("hotel_reservations")
      .select("*")
      .eq("id", reservationId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!res) return { success: false, error: "Réservation introuvable" };

    const [{ data: rrows }, { data: types }, { data: plans }, { data: allRooms }, { data: payments }] =
      await Promise.all([
        db
          .from("hotel_reservation_rooms")
          .select("id, room_type_id, rate_plan_id, room_id, guest_name, status")
          .eq("reservation_id", reservationId),
        db.from("hotel_room_types").select("id, nom").eq("organization_id", orgId),
        db.from("hotel_rate_plans").select("id, nom").eq("organization_id", orgId),
        db.from("hotel_rooms").select("id, numero, room_type_id, is_active").eq("organization_id", orgId),
        db
          .from("hotel_payments")
          .select("id, method, kind, amount_cents, note, created_at")
          .eq("reservation_id", reservationId)
          .order("created_at", { ascending: true }),
      ]);

    const typeName = new Map((types ?? []).map((t) => [t.id as string, t.nom as string]));
    const planName = new Map((plans ?? []).map((p) => [p.id as string, p.nom as string]));
    const roomNumber = new Map((allRooms ?? []).map((r) => [r.id as string, r.numero as string]));

    const roomsByType: Record<string, { id: string; numero: string }[]> = {};
    for (const r of allRooms ?? []) {
      if (!(r.is_active as boolean)) continue;
      const t = r.room_type_id as string;
      (roomsByType[t] ??= []).push({ id: r.id as string, numero: r.numero as string });
    }

    return {
      success: true,
      data: {
        id: res.id as string,
        reference: res.reference as string,
        customerName: res.customer_name as string | null,
        customerEmail: res.customer_email as string | null,
        status: res.status as HotelReservationStatus,
        checkIn: res.check_in as string,
        checkOut: res.check_out as string,
        adults: res.adults as number,
        children: res.children as number,
        totalCents: res.total_cents as number,
        balanceCents: res.balance_cents as number,
        paidCents: res.paid_cents as number,
        notes: res.notes as string | null,
        rooms: (rrows ?? []).map((r) => ({
          id: r.id as string,
          roomTypeId: r.room_type_id as string,
          roomTypeName: typeName.get(r.room_type_id as string) ?? "—",
          ratePlanName: planName.get(r.rate_plan_id as string) ?? "—",
          roomId: r.room_id as string | null,
          roomNumber: r.room_id ? roomNumber.get(r.room_id as string) ?? null : null,
          guestName: r.guest_name as string | null,
          status: r.status as HotelReservationStatus,
        })),
        roomsByType,
        payments: (payments ?? []).map((p) => ({
          id: p.id as string,
          method: p.method as HotelPaymentMethod,
          kind: p.kind as HotelPaymentKind,
          amountCents: p.amount_cents as number,
          note: p.note as string | null,
          createdAt: p.created_at as string,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

/**
 * Enregistre un paiement (comptable, sans encaissement carte) et recalcule
 * paid_cents / balance_cents du dossier depuis l'ensemble des paiements.
 */
export async function recordPayment(
  reservationId: string,
  input: { method: HotelPaymentMethod; kind: HotelPaymentKind; amountEur: number; note: string | null }
): Promise<HotelActionResult> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const amount = Math.round(input.amountEur * 100);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, error: "Montant invalide." };
    }

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;

    const { data: res } = await db
      .from("hotel_reservations")
      .select("total_cents")
      .eq("id", reservationId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!res) return { success: false, error: "Réservation introuvable" };

    const { data: folio } = await db
      .from("hotel_folios")
      .select("id")
      .eq("reservation_id", reservationId)
      .maybeSingle();

    const { error: insError } = await db.from("hotel_payments").insert({
      organization_id: orgId,
      reservation_id: reservationId,
      folio_id: (folio?.id as string | undefined) ?? null,
      method: input.method,
      kind: input.kind,
      amount_cents: amount,
      note: input.note?.trim() || null,
    });
    if (insError) return { success: false, error: insError.message };

    // Recalcule le payé (dépôt + solde − remboursements).
    const { data: all } = await db
      .from("hotel_payments")
      .select("kind, amount_cents")
      .eq("reservation_id", reservationId)
      .eq("organization_id", orgId);
    const paid = (all ?? []).reduce((s, p) => {
      const a = p.amount_cents as number;
      return s + ((p.kind as HotelPaymentKind) === "refund" ? -a : a);
    }, 0);

    const total = res.total_cents as number;
    await db
      .from("hotel_reservations")
      .update({ paid_cents: paid, balance_cents: total - paid })
      .eq("id", reservationId)
      .eq("organization_id", orgId);

    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

// Transitions autorisées du dossier.
const TRANSITIONS: Record<HotelReservationStatus, HotelReservationStatus[]> = {
  option: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "no_show", "cancelled"],
  checked_in: ["checked_out"],
  checked_out: [],
  no_show: [],
  cancelled: [],
};

export async function updateReservationStatus(
  reservationId: string,
  status: HotelReservationStatus
): Promise<HotelActionResult> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data: res } = await db
      .from("hotel_reservations")
      .select("status")
      .eq("id", reservationId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();
    if (!res) return { success: false, error: "Réservation introuvable" };

    const from = res.status as HotelReservationStatus;
    if (!TRANSITIONS[from].includes(status)) {
      return { success: false, error: `Transition ${from} → ${status} non autorisée.` };
    }

    const patch: Record<string, unknown> = { status };
    if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
    const { error } = await db
      .from("hotel_reservations")
      .update(patch)
      .eq("id", reservationId)
      .eq("organization_id", access.organizationId);
    if (error) return { success: false, error: error.message };

    // Reflète le statut sur les chambres du dossier (libère l'exclusion si annulé/no-show).
    await db
      .from("hotel_reservation_rooms")
      .update({ status })
      .eq("reservation_id", reservationId)
      .eq("organization_id", access.organizationId);

    // Annulation / no-show : libère l'inventaire réservé au niveau type.
    if (status === "cancelled" || status === "no_show") {
      const { data: rooms } = await db
        .from("hotel_reservation_rooms")
        .select("room_type_id, check_in, check_out")
        .eq("reservation_id", reservationId)
        .eq("organization_id", access.organizationId);
      const items = (rooms ?? []).map((r) => ({
        room_type_id: r.room_type_id as string,
        check_in: r.check_in as string,
        check_out: r.check_out as string,
      }));
      if (items.length > 0) {
        await db.rpc("hotel_reserve_inventory", {
          p_org: access.organizationId,
          p_items: items,
          p_release: true,
        });
      }
    }

    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function assignRoom(
  reservationRoomId: string,
  roomId: string | null
): Promise<HotelActionResult> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;

    const { data: rr } = await db
      .from("hotel_reservation_rooms")
      .select("id, room_type_id")
      .eq("id", reservationRoomId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!rr) return { success: false, error: "Ligne de réservation introuvable" };

    if (roomId) {
      const { data: room } = await db
        .from("hotel_rooms")
        .select("id, room_type_id")
        .eq("id", roomId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (!room) return { success: false, error: "Chambre invalide" };
      if (room.room_type_id !== rr.room_type_id) {
        return { success: false, error: "La chambre doit correspondre au type réservé." };
      }
    }

    const { error } = await db
      .from("hotel_reservation_rooms")
      .update({ room_id: roomId })
      .eq("id", reservationRoomId)
      .eq("organization_id", orgId);
    if (error) {
      // 23P01 = exclusion_violation (chevauchement de chambre).
      if (error.code === "23P01" || error.message.includes("exclusion")) {
        return { success: false, error: "Cette chambre est déjà occupée sur ces dates." };
      }
      return { success: false, error: error.message };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function listReservations(): Promise<HotelActionResult<ReservationListItem[]>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data, error } = await db
      .from("hotel_reservations")
      .select("id, reference, customer_name, status, check_in, check_out, total_cents")
      .eq("organization_id", access.organizationId)
      .order("check_in", { ascending: false })
      .limit(100);
    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: (data ?? []).map((r) => ({
        id: r.id as string,
        reference: r.reference as string,
        customerName: r.customer_name as string | null,
        status: r.status as HotelReservationStatus,
        checkIn: r.check_in as string,
        checkOut: r.check_out as string,
        totalCents: r.total_cents as number,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
