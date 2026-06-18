import "server-only";

import { requireRegiaireAccess } from "@/lib/organizations/access";
import { forWrite } from "@/lib/supabase-write";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
  type ServerSupabaseClient,
} from "@/server/auth/supabase-server";

export type RegiaireContextErrorCode =
  | "unauthenticated"
  | "no_organization"
  | "module_disabled";

export class RegiaireContextError extends Error {
  readonly code: RegiaireContextErrorCode;

  constructor(code: RegiaireContextErrorCode, message: string) {
    super(message);
    this.name = "RegiaireContextError";
    this.code = code;
  }
}

export type RegiaireContext = {
  userId: string;
  userEmail: string | undefined;
  organizationId: string;
  supabase: ServerSupabaseClient;
  db: ReturnType<typeof forWrite>;
};

const ERROR_MESSAGES: Record<RegiaireContextErrorCode, string> = {
  unauthenticated: "Authentification requise",
  no_organization: "Aucune organisation associée",
  module_disabled: "Module RégiAire non activé pour votre organisation",
};

/**
 * Contexte serveur RégiAire : session Supabase + org + module regiaire_core.
 * Ne jamais dériver organizationId / userId depuis le body ou la query.
 */
export async function requireRegiaireContext(): Promise<RegiaireContext> {
  const access = await requireRegiaireAccess();
  if (!access.allowed) {
    throw new RegiaireContextError(
      access.reason,
      ERROR_MESSAGES[access.reason]
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    throw new RegiaireContextError("unauthenticated", ERROR_MESSAGES.unauthenticated);
  }

  const supabase = await createServerSupabaseClient();

  return {
    userId: user.id,
    userEmail: user.email,
    organizationId: access.organizationId,
    supabase,
    db: forWrite(supabase),
  };
}
