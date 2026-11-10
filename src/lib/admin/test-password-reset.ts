// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { randomInt } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Utilitaire de TEST : (ré)initialise le mot de passe d'un compte à la volée,
 * avec un mot de passe unique par compte. Réservé aux environnements de test.
 *
 * ⚠️ Double garde de sécurité :
 *  - accès admin plateforme (vérifié en amont par la route via requireAdminUser),
 *  - flag d'environnement `ALLOW_TEST_PASSWORD_RESET=true` (sinon désactivé).
 * Ne JAMAIS activer ce flag en production : l'endpoint renvoie des mots de passe
 * en clair et écrase les mots de passe existants.
 */

export class TestPasswordDisabledError extends Error {
  constructor() {
    super(
      "Réinitialisation de mot de passe de test désactivée. Définissez ALLOW_TEST_PASSWORD_RESET=true (hors production)."
    );
    this.name = "TestPasswordDisabledError";
  }
}

/** Vrai uniquement si le flag de test est explicitement activé. */
export function isTestPasswordResetEnabled(): boolean {
  return process.env.ALLOW_TEST_PASSWORD_RESET === "true";
}

function assertEnabled(): void {
  if (!isTestPasswordResetEnabled()) {
    throw new TestPasswordDisabledError();
  }
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

// Alphabet sans caractères ambigus (0/O, 1/l/I) pour une copie fiable en test.
const PWD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PWD_LENGTH = 14;

/** Génère un mot de passe aléatoire fort et unique (crypto). */
export function generateUniquePassword(length: number = PWD_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PWD_ALPHABET[randomInt(PWD_ALPHABET.length)];
  }
  return out;
}

export type TestAccount = {
  userId: string;
  email: string | null;
  lastSignInAt: string | null;
  createdAt: string | null;
};

/** Liste tous les comptes auth (paginé). Aucun mot de passe exposé ici. */
export async function listAuthAccounts(): Promise<TestAccount[]> {
  assertEnabled();
  const admin = getServiceClient();
  const accounts: TestAccount[] = [];
  const perPage = 200;

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    for (const u of data.users) {
      accounts.push({
        userId: u.id,
        email: u.email ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        createdAt: u.created_at ?? null,
      });
    }

    if (data.users.length < perPage) break;
  }

  accounts.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  return accounts;
}

export type PasswordResetResult = {
  userId: string;
  email: string | null;
  password: string;
};

/**
 * (Ré)initialise le mot de passe d'un compte. Si `password` n'est pas fourni,
 * un mot de passe unique est généré. Désarme aussi le flag de changement forcé
 * (`must_change_password`) pour pouvoir se connecter directement.
 */
export async function resetAccountPassword(
  userId: string,
  password?: string
): Promise<PasswordResetResult> {
  assertEnabled();
  const admin = getServiceClient();

  const finalPassword = password?.trim() ? password.trim() : generateUniquePassword();
  if (finalPassword.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  // Fusionne les métadonnées existantes pour ne pas les écraser.
  const { data: existing } = await admin.auth.admin.getUserById(userId);
  const currentMeta = existing?.user?.user_metadata ?? {};

  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    password: finalPassword,
    user_metadata: { ...currentMeta, must_change_password: false },
  });
  if (error) throw new Error(error.message);

  return {
    userId,
    email: data.user?.email ?? existing?.user?.email ?? null,
    password: finalPassword,
  };
}

/**
 * Attribue un mot de passe unique à CHAQUE compte et renvoie la liste complète
 * (email → mot de passe). Pratique pour repartir d'un jeu de comptes de test.
 */
export async function resetAllAccountPasswords(): Promise<PasswordResetResult[]> {
  assertEnabled();
  const accounts = await listAuthAccounts();
  const results: PasswordResetResult[] = [];

  for (const account of accounts) {
    const result = await resetAccountPassword(account.userId);
    results.push(result);
  }

  return results;
}
