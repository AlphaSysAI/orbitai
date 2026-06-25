// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { randomBytes } from "crypto";

import { createClient } from "@supabase/supabase-js";

import { canManageAireTeam } from "@/lib/regiaire/aire-scope";
import type { RegiaireContext } from "@/lib/regiaire/require-context";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

export type AireTeamMember = {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
};

export type CreateAireEmployeeInput = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export type CreateAireEmployeeResult = {
  userId: string;
  email: string;
};

export async function listAireTeamMembers(
  ctx: RegiaireContext
): Promise<AireTeamMember[]> {
  const allowed = await canManageAireTeam(ctx);
  if (!allowed) {
    throw new Error("Accès réservé au gérant de l'aire ou à l'administration.");
  }

  const { data: rows, error } = await ctx.db
    .from("aire_team_members")
    .select("user_id, created_at")
    .eq("organization_id", ctx.organizationId)
    .eq("aire_id", ctx.aireId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const admin = getServiceClient();
  const members: AireTeamMember[] = [];

  for (const row of rows ?? []) {
    const userId = row.user_id as string;
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const meta = authUser.user?.user_metadata as Record<string, unknown> | undefined;

    members.push({
      userId,
      email: authUser.user?.email ?? null,
      firstName:
        typeof meta?.first_name === "string" ? meta.first_name : null,
      lastName: typeof meta?.last_name === "string" ? meta.last_name : null,
      createdAt: row.created_at as string,
    });
  }

  return members;
}

export async function createAireEmployee(
  ctx: RegiaireContext,
  input: CreateAireEmployeeInput
): Promise<CreateAireEmployeeResult> {
  const allowed = await canManageAireTeam(ctx);
  if (!allowed) {
    throw new Error("Accès réservé au gérant de l'aire ou à l'administration.");
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (!email || password.length < 8) {
    throw new Error("Email valide et mot de passe (8 caractères min.) requis.");
  }

  const admin = getServiceClient();
  const db = forWrite(admin);

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
    },
  });

  if (authError) {
    if (authError.message.toLowerCase().includes("already")) {
      throw new Error("Un compte existe déjà avec cet email.");
    }
    throw new Error(authError.message);
  }

  if (!authUser.user) {
    throw new Error("Échec de création du compte.");
  }

  const userId = authUser.user.id;

  try {
    const { error: memberError } = await db.from("organization_members").insert({
      organization_id: ctx.organizationId,
      user_id: userId,
      role: "employe",
    });

    if (memberError) {
      throw new Error(memberError.message);
    }

    const { error: teamError } = await db.from("aire_team_members").insert({
      user_id: userId,
      aire_id: ctx.aireId,
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
    });

    if (teamError) {
      throw new Error(teamError.message);
    }

    return { userId, email };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

export async function removeAireEmployee(
  ctx: RegiaireContext,
  memberUserId: string
): Promise<void> {
  const allowed = await canManageAireTeam(ctx);
  if (!allowed) {
    throw new Error("Accès réservé au gérant de l'aire ou à l'administration.");
  }

  if (memberUserId === ctx.userId) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte ici.");
  }

  const admin = getServiceClient();
  const db = forWrite(admin);

  const { data: membership, error: membershipError } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error("Employé introuvable dans l'organisation.");
  }

  if (membership.role !== "employe") {
    throw new Error("Seuls les comptes employé peuvent être retirés ici.");
  }

  const { data: assignment, error: assignmentError } = await db
    .from("aire_team_members")
    .select("aire_id")
    .eq("organization_id", ctx.organizationId)
    .eq("aire_id", ctx.aireId)
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (assignmentError || !assignment) {
    throw new Error("Employé non rattaché à cette aire.");
  }

  const { error: deleteTeamError } = await db
    .from("aire_team_members")
    .delete()
    .eq("organization_id", ctx.organizationId)
    .eq("aire_id", ctx.aireId)
    .eq("user_id", memberUserId);

  if (deleteTeamError) {
    throw new Error(deleteTeamError.message);
  }

  const { count, error: countError } = await db
    .from("aire_team_members")
    .select("aire_id", { count: "exact", head: true })
    .eq("user_id", memberUserId);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) === 0) {
    const { error: memberDeleteError } = await db
      .from("organization_members")
      .delete()
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", memberUserId);

    if (memberDeleteError) {
      throw new Error(memberDeleteError.message);
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(
      memberUserId
    );

    if (authDeleteError) {
      throw new Error(authDeleteError.message);
    }
  }
}

export function generateEmployeePassword(): string {
  return randomBytes(10).toString("base64url");
}
