// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { cache } from "react";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import { forWrite } from "@/lib/supabase-write";
import type { ServerSupabaseClient } from "@/server/auth/supabase-server";

/** Rôles voyant toutes les aires de leur organisation (modèle plat). */
export const FULL_AIRE_ACCESS_ROLES = new Set(["owner", "admin", "member"]);

type Db = ReturnType<typeof forWrite>;

/**
 * Rôle d'un membre dans une organisation.
 *
 * Mémoïsé par requête via `React.cache()` : le rôle est relu à de multiples
 * étapes d'une même requête (contexte aire, capabilities, scope…). Le client
 * `db` a une référence stable par requête (client Supabase mémoïsé + `forWrite`
 * qui ne fait que caster), la clé de mémoïsation est donc fiable.
 */
export const getMembershipRole = cache(async (
  db: Db,
  organizationId: string,
  userId: string
): Promise<string | null> => {
  const { data, error } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.role) return null;
  return data.role as string;
});

/**
 * Aires accessibles à un utilisateur.
 * - owner / admin / member : toutes les aires de l'org.
 * - employe : uniquement les aires où il est rattaché (aire_team_members).
 */
export async function listAccessibleAireIds(
  db: Db,
  organizationId: string,
  userId: string,
  role: string
): Promise<string[] | "all"> {
  if (FULL_AIRE_ACCESS_ROLES.has(role)) {
    return "all";
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

  return [];
}

/** Gestion de l'équipe d'une aire : réservée aux administrateurs d'organisation. */
export async function canManageAireTeam(
  ctx: RegiaireContext
): Promise<boolean> {
  const role = await getMembershipRole(ctx.db, ctx.organizationId, ctx.userId);
  return role === "owner" || role === "admin";
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
  void aireId;
  const db = forWrite(supabase);
  const role = (await getMembershipRole(db, organizationId, userId)) ?? "member";
  const isAdmin = role === "owner" || role === "admin";

  return { role, isAdmin };
}
