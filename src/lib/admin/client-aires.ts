// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { createClient } from "@supabase/supabase-js";

import type {
  AdminClientAireInput,
  AdminClientAireRecord,
} from "@/lib/admin/client-aire-schema";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";
import {
  generateAireEmailSlug,
  makeSlugUnique,
} from "@/features/regiaire/inbound/lib/generate-slug";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

export async function listAiresForOrganization(
  organizationId: string
): Promise<AdminClientAireRecord[]> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const { data, error } = await db
    .from("aires")
    .select(
      "id, name, address, city, lat, lon, school_zone, order_days, bison_fute_zone, email_slug"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address ?? "",
    city: row.city ?? undefined,
    lat: Number(row.lat),
    lon: Number(row.lon),
    schoolZone: row.school_zone as "A" | "B" | "C",
    orderDays: row.order_days ?? [1, 2, 3, 4, 5],
    bisonFuteZone: row.bison_fute_zone ?? null,
    emailSlug: (row.email_slug as string | null) ?? null,
  }));
}

async function resolveUniqueSlugService(
  db: ReturnType<typeof forWrite>,
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

export async function insertAiresForOrganization(
  organizationId: string,
  aires: AdminClientAireInput[]
): Promise<void> {
  if (aires.length === 0) return;

  const admin = getServiceClient();
  const db = forWrite(admin);

  const rows = await Promise.all(
    aires.map(async (aire) => ({
      organization_id: organizationId,
      name: aire.name.trim(),
      address: aire.address.trim(),
      city: aire.city?.trim() || null,
      lat: aire.lat,
      lon: aire.lon,
      school_zone: aire.schoolZone,
      order_days: aire.orderDays,
      bison_fute_zone: aire.bisonFuteZone ?? null,
      email_slug: await resolveUniqueSlugService(db, aire.name.trim()),
    }))
  );

  const { error } = await db.from("aires").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncAiresForOrganization(
  organizationId: string,
  aires: AdminClientAireInput[]
): Promise<void> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const existing = await listAiresForOrganization(organizationId);
  const payloadIds = new Set(
    aires.map((a) => a.id).filter((id): id is string => Boolean(id))
  );

  const toDelete = existing.filter((e) => !payloadIds.has(e.id));
  for (const aire of toDelete) {
    const { error } = await db.from("aires").delete().eq("id", aire.id);
    if (error) {
      if (error.code === "23503") {
        throw new Error(
          `Impossible de supprimer « ${aire.name} » : des données opérationnelles y sont liées.`
        );
      }
      throw new Error(error.message);
    }
  }

  for (const aire of aires) {
    const row = {
      name: aire.name.trim(),
      address: aire.address.trim(),
      city: aire.city?.trim() || null,
      lat: aire.lat,
      lon: aire.lon,
      school_zone: aire.schoolZone,
      order_days: aire.orderDays,
      bison_fute_zone: aire.bisonFuteZone ?? null,
    };

    if (aire.id) {
      const { error } = await db
        .from("aires")
        .update(row)
        .eq("id", aire.id)
        .eq("organization_id", organizationId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await db.from("aires").insert({
        organization_id: organizationId,
        ...row,
      });

      if (error) {
        throw new Error(error.message);
      }
    }
  }
}
