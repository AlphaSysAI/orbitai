"use server";

import {
  AireInputSchema,
  AireSchema,
  type Aire,
} from "@/features/regiaire/aires/schemas";
import {
  OrgContextError,
  requireOrgAdminContext,
} from "@/lib/organizations/org-context";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";
import {
  generateAireEmailSlug,
  makeSlugUnique,
} from "@/features/regiaire/inbound/lib/generate-slug";

export type MutateAireActionResult =
  | { success: true; data: Aire }
  | { success: false; error: string; code?: string };

async function resolveUniqueSlug(
  db: Awaited<ReturnType<typeof requireOrgAdminContext>>["db"],
  name: string
): Promise<string> {
  const base = generateAireEmailSlug(name);

  const { data } = await db
    .from("aires")
    .select("email_slug")
    .not("email_slug", "is", null);

  const existing = new Set(
    (data ?? []).map((r) => r.email_slug as string).filter(Boolean)
  );

  return makeSlugUnique(base, existing);
}

export async function createAire(
  input: unknown
): Promise<MutateAireActionResult> {
  try {
    const admin = await requireOrgAdminContext();
    const parsed = AireInputSchema.parse(input);
    const city = parsed.city?.trim() || null;
    const emailSlug = await resolveUniqueSlug(admin.db, parsed.name.trim());

    const { data, error } = await admin.db
      .from("aires")
      .insert({
        organization_id: admin.organizationId,
        name: parsed.name.trim(),
        city,
        lat: parsed.lat,
        lon: parsed.lon,
        school_zone: parsed.schoolZone,
        order_days: parsed.orderDays,
        bison_fute_zone: parsed.bisonFuteZone ?? null,
        email_slug: emailSlug,
      })
      .select(
        "id, organization_id, name, lat, lon, city, school_zone, order_days, bison_fute_zone, email_slug, created_at"
      )
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Création impossible" };
    }

    return {
      success: true,
      data: AireSchema.parse({
        id: data.id,
        organizationId: data.organization_id,
        name: data.name,
        lat: Number(data.lat),
        lon: Number(data.lon),
        city: data.city,
        schoolZone: data.school_zone,
        orderDays: data.order_days,
        bisonFuteZone: data.bison_fute_zone ?? null,
        emailSlug: data.email_slug ?? null,
        createdAt: data.created_at,
      }),
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la création";
    return { success: false, error: message };
  }
}

export async function updateAire(
  aireId: string,
  input: unknown
): Promise<MutateAireActionResult> {
  try {
    await requireOrgAdminContext();
    const ctx = await requireRegiaireContext(aireId);
    const parsed = AireInputSchema.parse(input);
    const city = parsed.city?.trim() || null;

    const { data, error } = await ctx.db
      .from("aires")
      .update({
        name: parsed.name.trim(),
        city,
        lat: parsed.lat,
        lon: parsed.lon,
        school_zone: parsed.schoolZone,
        order_days: parsed.orderDays,
        bison_fute_zone: parsed.bisonFuteZone ?? null,
      })
      .eq("id", ctx.aireId)
      .select(
        "id, organization_id, name, lat, lon, city, school_zone, order_days, bison_fute_zone, email_slug, created_at"
      )
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Mise à jour impossible" };
    }

    return {
      success: true,
      data: AireSchema.parse({
        id: data.id,
        organizationId: data.organization_id,
        name: data.name,
        lat: Number(data.lat),
        lon: Number(data.lon),
        city: data.city,
        schoolZone: data.school_zone,
        orderDays: data.order_days,
        bisonFuteZone: data.bison_fute_zone ?? null,
        emailSlug: data.email_slug ?? null,
        createdAt: data.created_at,
      }),
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}
