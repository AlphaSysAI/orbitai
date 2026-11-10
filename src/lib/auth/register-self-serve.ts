// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

export type RegisterSelfServeInput = {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  businessSector?: string;
};

export type RegisterSelfServeResult = {
  organizationId: string;
  userId: string;
  email: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

/**
 * Inscription en libre-service : le prospect crée lui-même son compte et son
 * organisation (rôle `owner`). Aucune feature n'est activée — il choisit son
 * abonnement ensuite depuis son espace (/abonnements).
 *
 * Le mot de passe est celui choisi par l'utilisateur et l'email est confirmé
 * d'office, afin qu'il puisse se connecter immédiatement.
 */
export async function registerSelfServe(
  input: RegisterSelfServeInput
): Promise<RegisterSelfServeResult> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const companyName = input.companyName.trim();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const businessSector = (input.businessSector ?? "").trim() || "Non précisé";

  if (!companyName || !firstName || !lastName || !email) {
    throw new Error("Tous les champs obligatoires doivent être renseignés.");
  }
  if (password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  // Création du compte auth avec le mot de passe choisi (email confirmé).
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      company_name: companyName,
    },
  });

  if (authError) {
    if (authError.message.toLowerCase().includes("already")) {
      throw new Error("Un compte existe déjà avec cet email.");
    }
    throw new Error(authError.message);
  }
  if (!created?.user) {
    throw new Error("Échec de création du compte.");
  }

  const userId = created.user.id;

  try {
    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({
        name: companyName,
        manager_first_name: firstName,
        manager_last_name: lastName,
        manager_email: email,
        business_sector: businessSector,
      })
      .select("id")
      .single();

    if (orgError || !org) {
      throw new Error(orgError?.message ?? "Échec création organisation.");
    }

    const { error: memberError } = await db.from("organization_members").insert({
      organization_id: org.id,
      user_id: userId,
      role: "owner",
    });

    if (memberError) {
      throw new Error(memberError.message);
    }

    return { organizationId: org.id, userId, email };
  } catch (error) {
    // Rollback du compte auth si la création de l'organisation échoue.
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}
