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
  | "invalid_aire"
  | "no_aire";

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
  /** Aire résolue (explicite ou aire par défaut de l'org). */
  aireId: string;
  supabase: ServerSupabaseClient;
  db: ReturnType<typeof forWrite>;
};

const ERROR_MESSAGES: Record<RegiaireContextErrorCode, string> = {
  unauthenticated: "Authentification requise",
  no_organization: "Aucune organisation associée",
  module_disabled: "Module RégiAire non activé pour votre organisation",
  invalid_aire: "Aire invalide ou inaccessible",
  no_aire: "Aucune aire configurée pour votre organisation",
};

async function resolveDefaultAireId(
  db: ReturnType<typeof forWrite>,
  organizationId: string
): Promise<string | null> {
  const { data, error } = await db
    .from("aires")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;
  return data.id as string;
}

async function resolveAireId(
  db: ReturnType<typeof forWrite>,
  organizationId: string,
  aireId?: string
): Promise<string> {
  if (aireId) {
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

  const defaultId = await resolveDefaultAireId(db, organizationId);
  if (!defaultId) {
    throw new RegiaireContextError("no_aire", ERROR_MESSAGES.no_aire);
  }

  return defaultId;
}

/**
 * Contexte serveur RégiAire : session + org + module + aire.
 * Sans aireId → aire par défaut (1ʳᵉ de l'org) pour compat UI legacy (retiré étape 2).
 */
export async function requireRegiaireContext(
  aireId?: string
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
