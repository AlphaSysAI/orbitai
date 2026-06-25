// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import { forWrite } from "@/lib/supabase-write";
import type { ServerSupabaseClient } from "@/server/auth/supabase-server";

export const FULL_AIRE_ACCESS_ROLES = new Set([
  "owner",
  "admin",
  "direction_france",
]);

type Db = ReturnType<typeof forWrite>;

export async function getMembershipRole(
  db: Db,
  organizationId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.role) return null;
  return data.role as string;
}

export async function listAccessibleAireIds(
  db: Db,
  organizationId: string,
  userId: string,
  role: string
): Promise<string[] | "all"> {
  if (FULL_AIRE_ACCESS_ROLES.has(role)) {
    return "all";
  }

  if (role === "gerant") {
    const { data, error } = await db
      .from("gerant_aires")
      .select("aire_id")
      .eq("gerant_user_id", userId)
      .eq("organization_id", organizationId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.aire_id as string);
  }

  if (role === "employe") {
    const { data, error } = await db
      .from("aire_team_members")
      .select("aire_id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.aire_id as string);
  }

  if (role === "chef_secteur") {
    const { data: secteurs, error: secteurError } = await db
      .from("secteurs")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("chef_user_id", userId);

    if (secteurError) throw new Error(secteurError.message);
    const secteurIds = (secteurs ?? []).map((s) => s.id as string);
    if (secteurIds.length === 0) return [];

    const { data: aires, error: aireError } = await db
      .from("aires")
      .select("id")
      .eq("organization_id", organizationId)
      .in("secteur_id", secteurIds);

    if (aireError) throw new Error(aireError.message);
    return (aires ?? []).map((a) => a.id as string);
  }

  if (role === "directeur_region") {
    const { data: links, error: linkError } = await db
      .from("org_hierarchy_links")
      .select("subordinate_user_id")
      .eq("manager_user_id", userId);

    if (linkError) throw new Error(linkError.message);
    const chefIds = (links ?? []).map((l) => l.subordinate_user_id as string);
    if (chefIds.length === 0) return [];

    const { data: secteurs, error: secteurError } = await db
      .from("secteurs")
      .select("id")
      .eq("organization_id", organizationId)
      .in("chef_user_id", chefIds);

    if (secteurError) throw new Error(secteurError.message);
    const secteurIds = (secteurs ?? []).map((s) => s.id as string);
    if (secteurIds.length === 0) return [];

    const { data: aires, error: aireError } = await db
      .from("aires")
      .select("id")
      .eq("organization_id", organizationId)
      .in("secteur_id", secteurIds);

    if (aireError) throw new Error(aireError.message);
    return (aires ?? []).map((a) => a.id as string);
  }

  return [];
}

export async function isGerantOfAire(
  db: Db,
  userId: string,
  aireId: string
): Promise<boolean> {
  const { data, error } = await db
    .from("gerant_aires")
    .select("aire_id")
    .eq("gerant_user_id", userId)
    .eq("aire_id", aireId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data != null;
}

export async function canManageAireTeam(
  ctx: RegiaireContext
): Promise<boolean> {
  const role = await getMembershipRole(ctx.db, ctx.organizationId, ctx.userId);
  if (!role) return false;
  if (role === "owner" || role === "admin" || role === "direction_france") {
    return true;
  }
  if (role === "gerant") {
    return isGerantOfAire(ctx.db, ctx.userId, ctx.aireId);
  }
  return false;
}

export async function canManageShiftOnAire(
  ctx: RegiaireContext
): Promise<boolean> {
  return canManageAireTeam(ctx);
}

export async function resolveShiftMemberFlags(
  organizationId: string,
  userId: string,
  aireId: string,
  supabase: ServerSupabaseClient
): Promise<{ role: string; isAdmin: boolean }> {
  const db = forWrite(supabase);
  const role = (await getMembershipRole(db, organizationId, userId)) ?? "member";
  const isOrgAdmin =
    role === "owner" || role === "admin" || role === "direction_france";
  const isGerant =
    role === "gerant" && (await isGerantOfAire(db, userId, aireId));

  return {
    role,
    isAdmin: isOrgAdmin || isGerant,
  };
}
