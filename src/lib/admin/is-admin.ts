// Copyright © 2026 OrbitSys. Tous droits réservés.

import { getAuthenticatedUser } from "@/server/auth/supabase-server";

function parseAdminEmails(): Set<string> {
  const raw = process.env.ORBIT_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const admins = parseAdminEmails();
  if (admins.size === 0) return false;
  return admins.has(email.trim().toLowerCase());
}

export async function requireAdminUser() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { ok: false as const, reason: "unauthenticated" as const };
  }
  if (!isAdminEmail(user.email)) {
    return { ok: false as const, reason: "forbidden" as const };
  }
  return { ok: true as const, user };
}
