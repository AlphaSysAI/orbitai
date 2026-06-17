import "server-only";

import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";
import { forWrite } from "@/lib/supabase-write";

import { ORG_MODULE_NAMES, type EnabledOrgModule, type OrganizationSummary } from "./types";

export type ModuleAccessResult =
  | { allowed: true; organizationId: string }
  | { allowed: false; reason: "unauthenticated" | "no_organization" | "module_disabled" };

/** Première organisation de l'utilisateur (ordre arbitraire — sélecteur multi-org en D.2). */
export async function getPrimaryOrganizationForUser(
  userId: string
): Promise<OrganizationSummary | null> {
  const supabase = await createServerSupabaseClient();
  const db = forWrite(supabase);

  const { data: membership, error: memberError } = await db
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (memberError || !membership?.organization_id) return null;

  const { data: org, error: orgError } = await db
    .from("organizations")
    .select("id, name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (orgError || !org) return null;
  return { id: org.id, name: org.name };
}

export async function getEnabledModulesForUser(userId: string): Promise<EnabledOrgModule[]> {
  const supabase = await createServerSupabaseClient();
  const db = forWrite(supabase);

  const { data, error } = await db.rpc("get_my_enabled_modules");
  if (error || !data) return [];

  return (data as { organization_id: string; module_name: string }[]).map((row) => ({
    organizationId: row.organization_id,
    moduleName: row.module_name,
  }));
}

export async function checkModuleAccess(
  moduleName: string
): Promise<ModuleAccessResult> {
  const user = await getAuthenticatedUser();
  if (!user) return { allowed: false, reason: "unauthenticated" };

  const org = await getPrimaryOrganizationForUser(user.id);
  if (!org) return { allowed: false, reason: "no_organization" };

  const supabase = await createServerSupabaseClient();
  const db = forWrite(supabase);
  const { data: allowed, error } = await db.rpc("org_has_module", {
    p_organization_id: org.id,
    p_module_name: moduleName,
  });

  if (error || !allowed) {
    return { allowed: false, reason: "module_disabled" };
  }

  return { allowed: true, organizationId: org.id };
}

export async function requireRegiaireAccess(): Promise<ModuleAccessResult> {
  return checkModuleAccess(ORG_MODULE_NAMES.REGIAIRE_CORE);
}
