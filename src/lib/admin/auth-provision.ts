// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { randomBytes } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mode dev : court-circuite l'email d'invitation Supabase (limites d'envoi).
 * Quand activé, le compte est créé directement avec un mot de passe provisoire
 * (email déjà confirmé) au lieu d'envoyer un lien d'invitation.
 * En prod : laisser non défini → invitation par email classique.
 */
export function skipInviteEmail(): boolean {
  return process.env.REGIAIRE_SKIP_INVITE_EMAIL === "true";
}

export function randomTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

export type CreatedAuthUser = { userId: string; tempPassword?: string };

/**
 * Crée le compte auth : invitation par email (prod) ou création directe avec
 * mot de passe provisoire (dev, cf. skipInviteEmail). Lève en cas d'erreur.
 */
export async function createOrInviteAuthUser(
  admin: SupabaseClient,
  params: {
    email: string;
    firstName: string;
    lastName: string;
    redirectTo: string;
    extraData?: Record<string, unknown>;
  }
): Promise<CreatedAuthUser> {
  const data = {
    first_name: params.firstName,
    last_name: params.lastName,
    ...(params.extraData ?? {}),
  };

  const handleError = (message: string): never => {
    if (message.toLowerCase().includes("already")) {
      throw new Error("Un compte existe déjà avec cet email.");
    }
    throw new Error(message);
  };

  if (skipInviteEmail()) {
    const tempPassword = randomTempPassword();
    const { data: created, error } = await admin.auth.admin.createUser({
      email: params.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: data,
    });
    if (error) handleError(error.message);
    if (!created?.user) throw new Error("Échec de création du compte utilisateur.");
    return { userId: created.user.id, tempPassword };
  }

  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(
    params.email,
    { redirectTo: params.redirectTo, data }
  );
  if (error) handleError(error.message);
  if (!invited?.user) throw new Error("Échec de création du compte utilisateur.");
  return { userId: invited.user.id };
}
