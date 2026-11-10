// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireHotelAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import type { HotelReservationStatus } from "@/types/database.types";

export type HotelActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type PlanningRoom = { id: string; numero: string; roomTypeId: string; roomTypeName: string };

export type PlanningAssignment = {
  reservationRoomId: string;
  reservationId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  guestName: string | null;
  reference: string;
  status: HotelReservationStatus;
};

export type PlanningUnassigned = {
  reservationRoomId: string;
  reservationId: string;
  roomTypeId: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  guestName: string | null;
  reference: string;
  status: HotelReservationStatus;
};

export type Planning = {
  from: string;
  to: string;
  roomTypes: { id: string; name: string }[];
  rooms: PlanningRoom[];
  assignments: PlanningAssignment[];
  unassigned: PlanningUnassigned[];
};

const ACTIVE: HotelReservationStatus[] = ["option", "confirmed", "checked_in", "checked_out"];

export async function getHotelPlanning(from: string, to: string): Promise<HotelActionResult<Planning>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const orgId = access.organizationId;

    const [{ data: types }, { data: rooms }, { data: rrows }] = await Promise.all([
      db.from("hotel_room_types").select("id, nom, sort_order").eq("organization_id", orgId).order("sort_order"),
      db.from("hotel_rooms").select("id, numero, room_type_id, is_active").eq("organization_id", orgId).order("numero"),
      // Chevauchement avec la fenêtre : check_in < to AND check_out > from.
      db
        .from("hotel_reservation_rooms")
        .select("id, reservation_id, room_type_id, room_id, check_in, check_out, guest_name, status")
        .eq("organization_id", orgId)
        .lt("check_in", to)
        .gt("check_out", from)
        .in("status", ACTIVE),
    ]);

    const typeName = new Map((types ?? []).map((t) => [t.id as string, t.nom as string]));

    // Références des réservations concernées.
    const resIds = Array.from(new Set((rrows ?? []).map((r) => r.reservation_id as string)));
    const refMap = new Map<string, string>();
    if (resIds.length > 0) {
      const { data: res } = await db
        .from("hotel_reservations")
        .select("id, reference")
        .in("id", resIds);
      for (const r of res ?? []) refMap.set(r.id as string, r.reference as string);
    }

    const assignments: PlanningAssignment[] = [];
    const unassigned: PlanningUnassigned[] = [];
    for (const r of rrows ?? []) {
      const base = {
        reservationRoomId: r.id as string,
        reservationId: r.reservation_id as string,
        checkIn: r.check_in as string,
        checkOut: r.check_out as string,
        guestName: r.guest_name as string | null,
        reference: refMap.get(r.reservation_id as string) ?? "—",
        status: r.status as HotelReservationStatus,
      };
      if (r.room_id) {
        assignments.push({ ...base, roomId: r.room_id as string });
      } else {
        unassigned.push({
          ...base,
          roomTypeId: r.room_type_id as string,
          roomTypeName: typeName.get(r.room_type_id as string) ?? "—",
        });
      }
    }

    return {
      success: true,
      data: {
        from,
        to,
        roomTypes: (types ?? []).map((t) => ({ id: t.id as string, name: t.nom as string })),
        rooms: (rooms ?? [])
          .filter((r) => r.is_active as boolean)
          .map((r) => ({
            id: r.id as string,
            numero: r.numero as string,
            roomTypeId: r.room_type_id as string,
            roomTypeName: typeName.get(r.room_type_id as string) ?? "—",
          })),
        assignments,
        unassigned,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
