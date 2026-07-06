// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import type { forWrite } from "@/lib/supabase-write";

type Db = ReturnType<typeof forWrite>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function nights(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${checkIn}T00:00:00Z`);
  const end = new Date(`${checkOut}T00:00:00Z`);
  while (cur < end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

const eur = (cents: number) => (cents / 100).toFixed(2);

/** Disponibilité par type de chambre pour une plage de dates. */
export async function hotelAvailability(
  db: Db,
  orgId: string,
  body: Record<string, unknown>
) {
  const checkIn = String(body.check_in ?? "");
  const checkOut = String(body.check_out ?? "");
  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) {
    return { error: "Dates invalides (attendu AAAA-MM-JJ, départ après arrivée)." };
  }

  const [{ data: types }, { data: rooms }, { data: inv }] = await Promise.all([
    db
      .from("hotel_room_types")
      .select("id, code, nom, default_rate_cents, capacity_adults, is_active")
      .eq("organization_id", orgId),
    db.from("hotel_rooms").select("room_type_id, is_active").eq("organization_id", orgId),
    db
      .from("hotel_inventory_calendar")
      .select("room_type_id, date, sold")
      .eq("organization_id", orgId)
      .gte("date", checkIn)
      .lt("date", checkOut),
  ]);

  const capacity = new Map<string, number>();
  for (const r of rooms ?? []) {
    if (!(r.is_active as boolean)) continue;
    const t = r.room_type_id as string;
    capacity.set(t, (capacity.get(t) ?? 0) + 1);
  }
  const maxSold = new Map<string, number>();
  for (const row of inv ?? []) {
    const t = row.room_type_id as string;
    maxSold.set(t, Math.max(maxSold.get(t) ?? 0, row.sold as number));
  }

  const available = (types ?? [])
    .filter((t) => t.is_active as boolean)
    .map((t) => {
      const cap = capacity.get(t.id as string) ?? 0;
      const sold = maxSold.get(t.id as string) ?? 0;
      return {
        code: t.code as string,
        name: t.nom as string,
        available_rooms: Math.max(0, cap - sold),
        price_per_night_eur: eur(t.default_rate_cents as number),
      };
    });

  return { check_in: checkIn, check_out: checkOut, nights: nights(checkIn, checkOut).length, room_types: available };
}

/** Crée une réservation en statut « option » (à confirmer par le staff). */
export async function hotelReserve(
  db: Db,
  orgId: string,
  body: Record<string, unknown>
) {
  const checkIn = String(body.check_in ?? "");
  const checkOut = String(body.check_out ?? "");
  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn) {
    return { error: "Dates invalides." };
  }
  const roomsIn = Array.isArray(body.rooms) ? (body.rooms as Record<string, unknown>[]) : [];
  if (roomsIn.length === 0) return { error: "Aucune chambre demandée." };

  const [{ data: types }, { data: plans }, { data: rateRows }] = await Promise.all([
    db.from("hotel_room_types").select("id, code, default_rate_cents").eq("organization_id", orgId),
    db.from("hotel_rate_plans").select("id, code").eq("organization_id", orgId),
    db
      .from("hotel_rate_calendar")
      .select("rate_plan_id, room_type_id, date, price_cents")
      .eq("organization_id", orgId)
      .gte("date", checkIn)
      .lt("date", checkOut),
  ]);

  const typeByCode = new Map((types ?? []).map((t) => [String(t.code).toLowerCase(), t]));
  const planByCode = new Map((plans ?? []).map((p) => [String(p.code).toLowerCase(), p.id as string]));
  const defaultPlanId = (plans ?? [])[0]?.id as string | undefined;
  const rateMap = new Map(
    (rateRows ?? []).map((r) => [`${r.rate_plan_id}|${r.room_type_id}|${r.date}`, r.price_cents as number])
  );
  const dates = nights(checkIn, checkOut);

  const payloadRooms: {
    room_type_id: string;
    rate_plan_id: string;
    guest_name: string | null;
    occupants: number;
    night_prices: number[];
  }[] = [];

  for (const r of roomsIn) {
    const type = typeByCode.get(String(r.room_type_code ?? "").toLowerCase());
    if (!type) return { error: `Type de chambre inconnu : ${String(r.room_type_code ?? "")}` };
    const planId = r.rate_plan_code
      ? planByCode.get(String(r.rate_plan_code).toLowerCase())
      : defaultPlanId;
    if (!planId) return { error: "Aucun plan tarifaire disponible." };

    const nightPrices = dates.map(
      (d) => rateMap.get(`${planId}|${type.id}|${d}`) ?? (type.default_rate_cents as number)
    );
    payloadRooms.push({
      room_type_id: type.id as string,
      rate_plan_id: planId,
      guest_name: r.guest_name ? String(r.guest_name) : null,
      occupants: Number(r.occupants) || 1,
      night_prices: nightPrices,
    });
  }

  const { data, error } = await db.rpc("hotel_create_reservation", {
    p_org: orgId,
    p_payload: {
      customer_name: body.customer_name ? String(body.customer_name) : null,
      customer_email: body.customer_email ? String(body.customer_email) : null,
      status: "option", // human-in-the-loop : confirmation par le staff
      check_in: checkIn,
      check_out: checkOut,
      adults: Number(body.adults) || 1,
      children: Number(body.children) || 0,
      rooms: payloadRooms,
    },
  });

  if (error) {
    const m = error.message;
    if (m.includes("no_inventory")) return { error: "Complet pour ces dates." };
    return { error: "Réservation impossible pour le moment." };
  }

  const result = data as { id: string; reference: string };
  return {
    ok: true,
    reference: result.reference,
    status: "option",
    message: "Réservation enregistrée en attente de confirmation par la réception.",
    reservation_id: result.id,
  };
}

/** Renvoie l'état d'une réservation depuis sa référence. */
export async function hotelReservationInfo(
  db: Db,
  orgId: string,
  body: Record<string, unknown>
) {
  const reference = String(body.reference ?? "").trim();
  if (!reference) return { error: "Référence manquante." };

  const { data } = await db
    .from("hotel_reservations")
    .select("reference, status, check_in, check_out, total_cents, balance_cents, customer_name")
    .eq("organization_id", orgId)
    .eq("reference", reference)
    .maybeSingle();

  if (!data) return { error: "Réservation introuvable." };
  return {
    reference: data.reference,
    status: data.status,
    check_in: data.check_in,
    check_out: data.check_out,
    customer_name: data.customer_name,
    total_eur: eur(data.total_cents as number),
    balance_eur: eur(data.balance_cents as number),
  };
}
