// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireHotelAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";

export type VoiceActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

const E164_RE = /^\+[1-9]\d{6,14}$/;

export async function getHotelVoiceNumber(): Promise<VoiceActionResult<{ phone: string | null }>> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const { data } = await db
      .from("voice_numbers")
      .select("phone_e164")
      .eq("organization_id", access.organizationId)
      .eq("vertical", "hotel")
      .maybeSingle();

    return { success: true, data: { phone: (data?.phone_e164 as string) ?? null } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function setHotelVoiceNumber(phone: string): Promise<VoiceActionResult> {
  try {
    const access = await requireHotelAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Hôtel non activé" };

    const normalized = phone.replace(/[\s.]/g, "");
    if (normalized && !E164_RE.test(normalized)) {
      return { success: false, error: "Numéro invalide (format international, ex. +33123456789)." };
    }

    const db = forWrite(await createServerSupabaseClient());
    // Un seul numéro par org+vertical : on remplace l'existant.
    await db
      .from("voice_numbers")
      .delete()
      .eq("organization_id", access.organizationId)
      .eq("vertical", "hotel");

    if (normalized) {
      const { error } = await db.from("voice_numbers").insert({
        phone_e164: normalized,
        organization_id: access.organizationId,
        vertical: "hotel",
      });
      if (error) {
        const msg = error.message.includes("duplicate")
          ? "Ce numéro est déjà rattaché à une autre organisation."
          : error.message;
        return { success: false, error: msg };
      }
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
