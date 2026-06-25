// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { randomBytes } from "crypto";

import { createClient } from "@supabase/supabase-js";

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

export type CreateOrgMemberInput = {
  organizationId: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export type CreateOrgMemberResult = {
  userId: string;
  email: string;
};

/**
 * Crée un utilisateur auth + membership member (service_role).
 * À appeler uniquement après requireOrgAdminContext côté appelant.
 */
export async function createOrgMemberUser(
  input: CreateOrgMemberInput
): Promise<CreateOrgMemberResult> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || password.length < 8) {
    throw new Error("Email valide et mot de passe (8 caractères min.) requis.");
  }

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
      organization_id: input.organizationId,
      user_id: userId,
      role: "member",
    });

    if (memberError) {
      throw new Error(memberError.message);
    }

    return { userId, email };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

export function generateMemberPassword(): string {
  return randomBytes(10).toString("base64url");
}
