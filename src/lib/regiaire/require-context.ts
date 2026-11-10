// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { requireRegiaireAccess } from "@/lib/organizations/access";
import {
  FULL_AIRE_ACCESS_ROLES,
  getMembershipRole,
} from "@/lib/regiaire/aire-scope";
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
  module_disabled: "Module Orbit Aire non activé pour votre organisation",
  missing_aire: "Identifiant d'aire requis",
  invalid_aire: "Aire invalide ou inaccessible",
};

type ResolvedAire = { id: string };

async function resolveAireId(
  db: ReturnType<typeof forWrite>,
  organizationId: string,
  aireId: string | undefined
): Promise<ResolvedAire> {
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

  return { id: data.id as string };
}

/**
 * Vérifie qu'un compte n'accède qu'aux aires de son périmètre :
 * - owner / admin / member : toutes les aires de l'org.
 * - employe : uniquement les aires de son rattachement (aire_team_members).
 */
async function checkAireScopeAccess(
  db: ReturnType<typeof forWrite>,
  organizationId: string,
  userId: string,
  aire: ResolvedAire
): Promise<void> {
  const role = await getMembershipRole(db, organizationId, userId);
  if (!role || FULL_AIRE_ACCESS_ROLES.has(role)) return;

  const deny = () => {
    throw new RegiaireContextError("invalid_aire", ERROR_MESSAGES.invalid_aire);
  };

  if (role === "employe") {
    const { data } = await db
      .from("aire_team_members")
      .select("aire_id")
      .eq("user_id", userId)
      .eq("aire_id", aire.id)
      .maybeSingle();
    if (!data) deny();
    return;
  }

  // Rôle inconnu → refus par défaut (principe du moindre privilège).
  deny();
}

/**
 * Contexte serveur Orbit Aire : session + org + module + aire (obligatoire).
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
  const aire = await resolveAireId(db, access.organizationId, aireId);

  await checkAireScopeAccess(db, access.organizationId, user.id, aire);

  return {
    userId: user.id,
    userEmail: user.email,
    organizationId: access.organizationId,
    aireId: aire.id,
    supabase,
    db,
  };
}
