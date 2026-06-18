"use server";

import {
  AireListItemSchema,
  type AireListItem,
} from "@/features/regiaire/aires/schemas";
import { requireRegiaireAccess } from "@/lib/organizations/access";
import { forWrite } from "@/lib/supabase-write";
import { createServerSupabaseClient } from "@/server/auth/supabase-server";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type ListAiresActionResult =
  | { success: true; data: AireListItem[] }
  | { success: false; error: string; code?: string };

export async function listAiresForOrg(): Promise<ListAiresActionResult> {
  try {
    const access = await requireRegiaireAccess();
    if (!access.allowed) {
      return {
        success: false,
        error: "Module RégiAire non activé",
        code: access.reason,
      };
    }

    const supabase = await createServerSupabaseClient();
    const db = forWrite(supabase);

    const { data, error } = await db
      .from("aires")
      .select("id, name, city, school_zone")
      .eq("organization_id", access.organizationId)
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const items = (data ?? []).map((row) =>
      AireListItemSchema.parse({
        id: row.id,
        name: row.name,
        city: row.city,
        schoolZone: row.school_zone,
      })
    );

    return { success: true, data: items };
  } catch (error) {
    return { success: false, error: "Erreur lors du chargement des aires" };
  }
}

export async function getAire(aireId: string) {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const { data, error } = await ctx.db
      .from("aires")
      .select("id, organization_id, name, lat, lon, city, school_zone, order_days, created_at")
      .eq("id", ctx.aireId)
      .single();

    if (error || !data) {
      return { success: false as const, error: "Aire introuvable" };
    }

    return {
      success: true as const,
      data: {
        id: data.id,
        organizationId: data.organization_id,
        name: data.name,
        lat: Number(data.lat),
        lon: Number(data.lon),
        city: data.city,
        schoolZone: data.school_zone,
        orderDays: data.order_days ?? [],
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false as const, error: error.message, code: error.code };
    }
    return { success: false as const, error: "Erreur serveur" };
  }
}
