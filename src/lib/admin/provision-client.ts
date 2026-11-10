// Copyright © 2026 OrbitSys. Tous droits réservés.

import { createClient } from "@supabase/supabase-js";

import { SELLABLE_FEATURE_IDS } from "@/lib/organizations/feature-catalog";
import { setOrganizationModules } from "@/lib/organizations/set-modules";
import type {
  AdminClientAireInput,
  AdminClientAireRecord,
} from "@/lib/admin/client-aire-schema";
import {
  insertAiresForOrganization,
  listAiresForOrganization,
} from "@/lib/admin/client-aires";
import { forWrite } from "@/lib/supabase-write";
import { createOrInviteAuthUser } from "@/lib/admin/auth-provision";
import type { Database } from "@/types/database.types";

export type ProvisionClientInput = {
  companyName: string;
  managerFirstName: string;
  managerLastName: string;
  managerEmail: string;
  businessSector: string;
  /** Ids de features vendables à activer d'office (catalogue à la carte). */
  featureIds: string[];
  aires?: AdminClientAireInput[];
};

export type ProvisionClientResult = {
  organizationId: string;
  userId: string;
  managerEmail: string;
  enabledFeatureIds: string[];
  tempPassword?: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

export async function provisionClient(
  input: ProvisionClientInput,
  topRole: string = "owner"
): Promise<ProvisionClientResult> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const companyName = input.companyName.trim();
  const managerFirstName = input.managerFirstName.trim();
  const managerLastName = input.managerLastName.trim();
  const managerEmail = input.managerEmail.trim().toLowerCase();
  const businessSector = input.businessSector.trim();
  const featureIds = input.featureIds.filter((id) => SELLABLE_FEATURE_IDS.has(id));

  if (!companyName || !managerFirstName || !managerLastName || !managerEmail || !businessSector) {
    throw new Error("Tous les champs obligatoires doivent être renseignés.");
  }

  // Invitation email (prod) ou création directe avec mot de passe provisoire (dev).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", ".vercel.app") ?? "http://localhost:3000";
  const redirectTo = `${siteUrl}/auth/callback?next=/auth/set-password`;

  const { userId, tempPassword } = await createOrInviteAuthUser(admin, {
    email: managerEmail,
    firstName: managerFirstName,
    lastName: managerLastName,
    redirectTo,
    extraData: { company_name: companyName },
  });

  try {
    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({
        name: companyName,
        manager_first_name: managerFirstName,
        manager_last_name: managerLastName,
        manager_email: managerEmail,
        business_sector: businessSector,
      })
      .select("id")
      .single();

    if (orgError || !org) {
      throw new Error(orgError?.message ?? "Échec création organisation.");
    }

    const { error: memberError } = await db.from("organization_members").insert({
      organization_id: org.id,
      user_id: userId,
      role: topRole,
    });

    if (memberError) {
      throw new Error(memberError.message);
    }

    // Active les features choisies + recalcule les modules « parapluie »
    // (regiaire_core / hotel_core) via la logique d'activation partagée.
    const enabledFeatureIds =
      featureIds.length > 0
        ? await setOrganizationModules(
            db,
            org.id,
            Object.fromEntries(featureIds.map((id) => [id, true]))
          )
        : [];

    if (input.aires && input.aires.length > 0) {
      await insertAiresForOrganization(org.id, input.aires);
    }

    return {
      organizationId: org.id,
      userId,
      managerEmail,
      enabledFeatureIds,
      tempPassword,
    };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

export type AdminClientListItem = {
  id: string;
  name: string;
  managerFirstName: string | null;
  managerLastName: string | null;
  managerEmail: string | null;
  businessSector: string | null;
  createdAt: string;
  enabledModules: string[];
  aires: AdminClientAireRecord[];
};

/**
 * Active / désactive une feature vendable pour un client (côté admin).
 * Réutilise la logique d'activation partagée (recalcule les parapluies).
 * @returns la liste des ids de features vendables actives après application.
 */
export async function setClientFeature(
  organizationId: string,
  featureId: string,
  enabled: boolean
): Promise<string[]> {
  const admin = getServiceClient();
  const db = forWrite(admin);
  return setOrganizationModules(db, organizationId, { [featureId]: enabled });
}

export async function deleteClient(organizationId: string): Promise<void> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  // Récupérer le manager pour supprimer son compte auth
  const { data: org } = await db
    .from("organizations")
    .select("manager_email")
    .eq("id", organizationId)
    .single();

  // Supprimer l'organisation (cascade sur organization_members, modules, aires, etc.)
  const { error: orgError } = await db
    .from("organizations")
    .delete()
    .eq("id", organizationId);

  if (orgError) {
    throw new Error(orgError.message);
  }

  // Supprimer le compte auth du manager si trouvé
  if (org?.manager_email) {
    const { data: users } = await admin.auth.admin.listUsers();
    const authUser = users?.users?.find(
      (u) => u.email?.toLowerCase() === (org.manager_email as string).toLowerCase()
    );
    if (authUser) {
      await admin.auth.admin.deleteUser(authUser.id);
    }
  }
}

export async function listClientsForAdmin(): Promise<AdminClientListItem[]> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const { data: orgs, error: orgError } = await db
    .from("organizations")
    .select("id, name, manager_first_name, manager_last_name, manager_email, business_sector, created_at")
    .order("created_at", { ascending: false });

  if (orgError || !orgs) {
    throw new Error(orgError?.message ?? "Impossible de charger les clients.");
  }

  const { data: modules, error: modError } = await db
    .from("organization_modules")
    .select("organization_id, module_name, is_enabled");

  if (modError) {
    throw new Error(modError.message);
  }

  const modulesByOrg = new Map<string, string[]>();
  for (const row of modules ?? []) {
    if (!row.is_enabled) continue;
    const list = modulesByOrg.get(row.organization_id) ?? [];
    list.push(row.module_name);
    modulesByOrg.set(row.organization_id, list);
  }

  const airesByOrg = new Map<string, AdminClientAireRecord[]>();
  const airesResults = await Promise.all(
    orgs.map(async (org) => ({
      orgId: org.id,
      aires: await listAiresForOrganization(org.id),
    }))
  );
  for (const { orgId, aires } of airesResults) {
    airesByOrg.set(orgId, aires);
  }

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    managerFirstName: org.manager_first_name,
    managerLastName: org.manager_last_name,
    managerEmail: org.manager_email,
    businessSector: org.business_sector,
    createdAt: org.created_at,
    enabledModules: modulesByOrg.get(org.id) ?? [],
    aires: airesByOrg.get(org.id) ?? [],
  }));
}
