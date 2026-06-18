import "server-only";

import type { RegiaireContext } from "@/lib/regiaire/require-context";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";
import { getPrimaryOrganizationForUser } from "@/lib/organizations/access";

export const ORG_ADMIN_ROLES = new Set(["owner", "admin"]);

export type OrgContext = {
  userId: string;
  userEmail: string | undefined;
  organizationId: string;
  role: string;
  isOrgAdmin: boolean;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  db: ReturnType<typeof forWrite>;
};

export class OrgContextError extends Error {
  constructor(
    message: string,
    readonly code: "unauthenticated" | "no_organization" | "forbidden" = "forbidden"
  ) {
    super(message);
    this.name = "OrgContextError";
  }
}

export async function requireOrgContext(): Promise<OrgContext> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new OrgContextError("Authentification requise", "unauthenticated");
  }

  const org = await getPrimaryOrganizationForUser(user.id);
  if (!org) {
    throw new OrgContextError("Aucune organisation associée", "no_organization");
  }

  const supabase = await createServerSupabaseClient();
  const db = forWrite(supabase);

  const { data: membership, error } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !membership?.role) {
    throw new OrgContextError("Membre introuvable", "no_organization");
  }

  const role = membership.role as string;

  return {
    userId: user.id,
    userEmail: user.email,
    organizationId: org.id,
    role,
    isOrgAdmin: ORG_ADMIN_ROLES.has(role),
    supabase,
    db,
  };
}

export async function requireOrgAdminContext(): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (!ctx.isOrgAdmin) {
    throw new OrgContextError(
      "Accès réservé aux administrateurs de l'organisation",
      "forbidden"
    );
  }
  return ctx;
}

export async function getMemberRoleFromCtx(
  ctx: RegiaireContext | OrgContext
): Promise<string | null> {
  const { data, error } = await ctx.db
    .from("organization_members")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (error || !data) return null;
  return data.role as string;
}

export function isOrgAdminRole(role: string | null | undefined): boolean {
  return role != null && ORG_ADMIN_ROLES.has(role);
}
