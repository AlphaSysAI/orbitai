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
  | "module_disabled"
  | "missing_aire"
  | "invalid_aire";

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
  aireId: string;
  supabase: ServerSupabaseClient;
  db: ReturnType<typeof forWrite>;
};

const ERROR_MESSAGES: Record<RegiaireContextErrorCode, string> = {
  unauthenticated: "Authentification requise",
  no_organization: "Aucune organisation associée",
  module_disabled: "Module RégiAire non activé pour votre organisation",
  missing_aire: "Identifiant d'aire requis",
  invalid_aire: "Aire invalide ou inaccessible",
};

async function resolveAireId(
  db: ReturnType<typeof forWrite>,
  organizationId: string,
  aireId: string | undefined
): Promise<string> {
  if (!aireId?.trim()) {
    throw new RegiaireContextError("missing_aire", ERROR_MESSAGES.missing_aire);
  }

  const { data, error } = await db
    .from("aires")
    .select("id, organization_id")
    .eq("id", aireId)
    .maybeSingle();

  if (error || !data || data.organization_id !== organizationId) {
    throw new RegiaireContextError("invalid_aire", ERROR_MESSAGES.invalid_aire);
  }

  return data.id as string;
}

/**
 * Contexte serveur RégiAire : session + org + module + aire (obligatoire).
 */
export async function requireRegiaireContext(
  aireId: string
): Promise<RegiaireContext> {
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
  const db = forWrite(supabase);
  const resolvedAireId = await resolveAireId(
    db,
    access.organizationId,
    aireId
  );

  return {
    userId: user.id,
    userEmail: user.email,
    organizationId: access.organizationId,
    aireId: resolvedAireId,
    supabase,
    db,
  };
}
