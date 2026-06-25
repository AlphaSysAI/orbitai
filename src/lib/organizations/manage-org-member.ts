// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

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

export type OrgMemberAuthDetails = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export async function getOrgMemberAuthDetails(
  userId: string
): Promise<OrgMemberAuthDetails | null> {
  const admin = getServiceClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return null;

  const meta = data.user.user_metadata as Record<string, unknown> | undefined;

  return {
    email: data.user.email ?? null,
    firstName: typeof meta?.first_name === "string" ? meta.first_name : null,
    lastName: typeof meta?.last_name === "string" ? meta.last_name : null,
  };
}

async function getMembershipRole(
  organizationId: string,
  userId: string
): Promise<string | null> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const { data, error } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.role) return null;
  return data.role as string;
}

export async function updateOrgMemberPassword(input: {
  organizationId: string;
  actorUserId: string;
  memberUserId: string;
  password: string;
}): Promise<void> {
  const password = input.password.trim();
  if (password.length < 8) {
    throw new Error("Mot de passe requis (8 caractères minimum).");
  }

  if (input.memberUserId === input.actorUserId) {
    throw new Error(
      "Pour votre propre compte, utilisez le changement de mot de passe standard."
    );
  }

  const role = await getMembershipRole(input.organizationId, input.memberUserId);
  if (!role) {
    throw new Error("Membre introuvable dans votre organisation.");
  }
  if (role !== "member") {
    throw new Error("Seuls les comptes membre peuvent être réinitialisés ici.");
  }

  const admin = getServiceClient();
  const { error } = await admin.auth.admin.updateUserById(input.memberUserId, {
    password,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteOrgMemberUser(input: {
  organizationId: string;
  actorUserId: string;
  memberUserId: string;
}): Promise<void> {
  if (input.memberUserId === input.actorUserId) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  }

  const role = await getMembershipRole(input.organizationId, input.memberUserId);
  if (!role) {
    throw new Error("Membre introuvable dans votre organisation.");
  }
  if (role !== "member") {
    throw new Error("Seuls les comptes membre peuvent être supprimés.");
  }

  const admin = getServiceClient();
  const db = forWrite(admin);

  const { error: memberError } = await db
    .from("organization_members")
    .delete()
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.memberUserId);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const { error: authError } = await admin.auth.admin.deleteUser(
    input.memberUserId
  );

  if (authError) {
    throw new Error(authError.message);
  }
}
