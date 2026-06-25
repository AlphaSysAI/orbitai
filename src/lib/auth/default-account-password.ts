// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

/** Mot de passe initial des comptes créés par l'application (surcharge via DEFAULT_ACCOUNT_PASSWORD). */
export function getDefaultAccountPassword(): string {
  const fromEnv = process.env.DEFAULT_ACCOUNT_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return "@mBr32005Sol!n3";
}

export function resolveAccountPassword(password?: string | null): string {
  const trimmed = password?.trim();
  return trimmed && trimmed.length >= 8
    ? trimmed
    : getDefaultAccountPassword();
}
