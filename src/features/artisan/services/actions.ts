// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { requireArtisanAccess } from "@/lib/organizations/access";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";

export type ArtisanActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ArtisanProfile = {
  businessName: string;
  description: string | null;
  laborRatePerHourCents: number | null;
};

export type ArtisanService = {
  id: string;
  title: string;
  durationMinutes: number;
  priceCents: number | null;
};

export async function getArtisanSettings(): Promise<
  ArtisanActionResult<{ profile: ArtisanProfile; services: ArtisanService[] }>
> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    const [{ data: profile }, { data: services }] = await Promise.all([
      db
        .from("artisan_profiles")
        .select("business_name, description, labor_rate_per_hour")
        .eq("organization_id", access.organizationId)
        .maybeSingle(),
      db
        .from("artisan_services")
        .select("id, title, duration, price")
        .eq("organization_id", access.organizationId)
        .order("title", { ascending: true }),
    ]);

    return {
      success: true,
      data: {
        profile: {
          businessName: (profile?.business_name as string) ?? "",
          description: (profile?.description as string | null) ?? null,
          laborRatePerHourCents: (profile?.labor_rate_per_hour as number | null) ?? null,
        },
        services: (services ?? []).map((s) => ({
          id: s.id as string,
          title: s.title as string,
          durationMinutes: s.duration as number,
          priceCents: (s.price as number | null) ?? null,
        })),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function updateArtisanProfile(input: {
  businessName: string;
  description: string;
  laborRateEur: number | null;
}): Promise<ArtisanActionResult> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const businessName = input.businessName.trim();
    if (!businessName) return { success: false, error: "Le nom de l'entreprise est requis." };
    if (input.laborRateEur !== null && input.laborRateEur < 0) {
      return { success: false, error: "Le taux horaire doit être positif." };
    }

    const db = forWrite(await createServerSupabaseClient());
    const { error } = await db
      .from("artisan_profiles")
      .update({
        business_name: businessName,
        description: input.description.trim() || null,
        labor_rate_per_hour:
          input.laborRateEur === null ? null : Math.round(input.laborRateEur * 100),
      })
      .eq("organization_id", access.organizationId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function createService(input: {
  title: string;
  durationMinutes: number;
  priceEur: number | null;
}): Promise<ArtisanActionResult<{ id: string }>> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const title = input.title.trim();
    if (!title) return { success: false, error: "Le titre de la prestation est requis." };
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
      return { success: false, error: "La durée doit être un nombre de minutes positif." };
    }

    const db = forWrite(await createServerSupabaseClient());
    const { data, error } = await db
      .from("artisan_services")
      .insert({
        organization_id: access.organizationId,
        title,
        duration: Math.round(input.durationMinutes),
        price: input.priceEur === null ? null : Math.round(input.priceEur * 100),
      })
      .select("id")
      .single();

    if (error || !data) return { success: false, error: error?.message ?? "Échec de création" };
    return { success: true, data: { id: data.id as string } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}

export async function deleteService(serviceId: string): Promise<ArtisanActionResult> {
  try {
    const access = await requireArtisanAccess();
    if (!access.allowed) return { success: false, error: "Module Orbit Artisan non activé" };

    const db = forWrite(await createServerSupabaseClient());
    // organization_id filtré en plus de la RLS (défense en profondeur).
    const { error } = await db
      .from("artisan_services")
      .delete()
      .eq("id", serviceId)
      .eq("organization_id", access.organizationId);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erreur serveur" };
  }
}
