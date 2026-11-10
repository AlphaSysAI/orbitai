// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminUser } from "@/lib/admin/is-admin";
import {
  isTestPasswordResetEnabled,
  listAuthAccounts,
  resetAccountPassword,
  resetAllAccountPasswords,
  TestPasswordDisabledError,
} from "@/lib/admin/test-password-reset";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json({ error: "Accès administrateur requis" }, { status: 403 });
}

function disabled() {
  return NextResponse.json(
    {
      error:
        "Fonction désactivée. Définissez ALLOW_TEST_PASSWORD_RESET=true (environnement de test uniquement).",
    },
    { status: 403 }
  );
}

/** Liste les comptes (sans mot de passe) pour l'écran d'admin. */
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin.ok) return forbidden();
  if (!isTestPasswordResetEnabled()) return disabled();

  try {
    const accounts = await listAuthAccounts();
    return NextResponse.json({ enabled: true, accounts });
  } catch (error) {
    if (error instanceof TestPasswordDisabledError) return disabled();
    console.error("[admin/test-passwords] GET échec:", error);
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const bodySchema = z.union([
  z.object({
    all: z.literal(true),
  }),
  z.object({
    userId: z.string().uuid(),
    password: z.string().min(8).max(72).optional(),
  }),
]);

/**
 * POST { userId, password? } → réinitialise un compte (mot de passe fourni ou généré).
 * POST { all: true }        → attribue un mot de passe unique à chaque compte.
 * Renvoie le(s) mot(s) de passe en clair (usage test uniquement).
 */
export async function POST(request: Request) {
  const admin = await requireAdminUser();
  if (!admin.ok) return forbidden();
  if (!isTestPasswordResetEnabled()) return disabled();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Paramètres invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if ("all" in parsed.data) {
      const results = await resetAllAccountPasswords();
      console.warn(
        `[admin/test-passwords] ${admin.user.email} a réinitialisé ${results.length} mots de passe (tous).`
      );
      return NextResponse.json({ results });
    }

    const result = await resetAccountPassword(parsed.data.userId, parsed.data.password);
    console.warn(
      `[admin/test-passwords] ${admin.user.email} a réinitialisé le mot de passe de ${result.email}.`
    );
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof TestPasswordDisabledError) return disabled();
    console.error("[admin/test-passwords] POST échec:", error);
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
