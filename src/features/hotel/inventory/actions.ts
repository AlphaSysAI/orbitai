// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireHotelAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import type { HotelHousekeepingStatus } from "@/types/database.types";

export type HotelActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type RoomType = {
  id: string;
  code: string;
  nom: string;
  capacityAdults: number;
  capacityChildren: number;
  defaultRateCents: number;
  isActive: boolean;
};

export type Room = {
  id: string;
  numero: string;
  etage: string | null;
  roomTypeId: string;
  roomTypeName: string;
  housekeepingStatus: HotelHousekeepingStatus;
  isActive: boolean;
};

export async function getHotelInventory(): Promise<
  HotelActionResult<{ roomTypes: RoomType[]; rooms: Room[] }>
> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const [{ data: types, error: typesError }, { data: rooms }] = await Promise.all([
      db
        .from("hotel_room_types")
        .select("id, code, nom, capacity_adults, capacity_children, default_rate_cents, is_active")
        .eq("organization_id", access.organizationId)
        .order("sort_order", { ascending: true }),
      db
        .from("hotel_rooms")
        .select("id, numero, etage, room_type_id, housekeeping_status, is_active")
        .eq("organization_id", access.organizationId)
        .order("numero", { ascending: true }),
    ]);
    if (typesError) return { success: false, error: typesError.message };

    const roomTypes: RoomType[] = (types ?? []).map((t) => ({
      id: t.id as string,
      code: t.code as string,
      nom: t.nom as string,
      capacityAdults: t.capacity_adults as number,
      capacityChildren: t.capacity_children as number,
      defaultRateCents: t.default_rate_cents as number,
      isActive: t.is_active as boolean,
    }));
    const typeName = new Map(roomTypes.map((t) => [t.id, t.nom]));

    return {
      success: true,
      data: {
        roomTypes,
        rooms: (rooms ?? []).map((r) => ({
          id: r.id as string,
          numero: r.numero as string,
          etage: r.etage as string | null,
          roomTypeId: r.room_type_id as string,
          roomTypeName: typeName.get(r.room_type_id as string) ?? "—",
          housekeepingStatus: r.housekeeping_status as HotelHousekeepingStatus,
          isActive: r.is_active as boolean,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function createRoomType(input: {
  code: string;
  nom: string;
  capacityAdults: number;
  defaultRateEur: number;
}): Promise<HotelActionResult<{ id: string }>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const code = input.code.trim();
    const nom = input.nom.trim();
    if (!code || !nom) return { success: false, error: "Code et nom requis." };

    const db = forWrite(await createServerSupabaseClient());
    const { data, error } = await db
      .from("hotel_room_types")
      .insert({
        organization_id: access.organizationId,
        code,
        nom,
        capacity_adults: Math.max(0, Math.round(input.capacityAdults)),
        default_rate_cents: Math.max(0, Math.round(input.defaultRateEur * 100)),
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

export async function createRoom(input: {
  numero: string;
  etage: string | null;
  roomTypeId: string;
}): Promise<HotelActionResult<{ id: string }>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const numero = input.numero.trim();
    if (!numero) return { success: false, error: "Numéro requis." };
    if (!input.roomTypeId) return { success: false, error: "Type de chambre requis." };

    const db = forWrite(await createServerSupabaseClient());
    // Vérifie que le type appartient bien à l'organisation (défense en profondeur).
    const { data: type } = await db
      .from("hotel_room_types")
      .select("id")
      .eq("id", input.roomTypeId)
      .eq("organization_id", access.organizationId)
      .maybeSingle();
    if (!type) return { success: false, error: "Type de chambre invalide." };

    const { data, error } = await db
      .from("hotel_rooms")
      .insert({
        organization_id: access.organizationId,
        room_type_id: input.roomTypeId,
        numero,
        etage: input.etage?.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      const msg = error?.message.includes("duplicate") ? "Ce numéro existe déjà." : error?.message;
      return { success: false, error: msg ?? "Échec de création" };
    }
    return { success: true, data: { id: data.id as string } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function deleteRoom(roomId: string): Promise<HotelActionResult> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { error } = await db
      .from("hotel_rooms")
      .delete()
      .eq("id", roomId)
      .eq("organization_id", access.organizationId);
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
