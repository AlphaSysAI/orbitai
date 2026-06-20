import { createClient } from "@supabase/supabase-js";

import { sanitizeModuleSelection } from "@/lib/organizations/module-catalog";
import type {
  AdminClientAireInput,
  AdminClientAireRecord,
} from "@/lib/admin/client-aire-schema";
import {
  insertAiresForOrganization,
  listAiresForOrganization,
} from "@/lib/admin/client-aires";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

export type ProvisionClientInput = {
  companyName: string;
  managerFirstName: string;
  managerLastName: string;
  managerEmail: string;
  businessSector: string;
  moduleNames: string[];
  aires?: AdminClientAireInput[];
};

export type ProvisionClientResult = {
  organizationId: string;
  userId: string;
  managerEmail: string;
  enabledModules: string[];
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
  input: ProvisionClientInput
): Promise<ProvisionClientResult> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const companyName = input.companyName.trim();
  const managerFirstName = input.managerFirstName.trim();
  const managerLastName = input.managerLastName.trim();
  const managerEmail = input.managerEmail.trim().toLowerCase();
  const businessSector = input.businessSector.trim();
  const enabledModules = sanitizeModuleSelection(input.moduleNames);

  if (!companyName || !managerFirstName || !managerLastName || !managerEmail || !businessSector) {
    throw new Error("Tous les champs obligatoires doivent être renseignés.");
  }

  // Invite via email — Supabase envoie un lien de setup sécurisé, aucun mot de passe
  // ne transite dans l'application ni dans ses logs.
  const { data: authUser, error: authError } = await admin.auth.admin.inviteUserByEmail(
    managerEmail,
    {
      data: {
        first_name: managerFirstName,
        last_name: managerLastName,
        company_name: companyName,
      },
    }
  );

  if (authError) {
    if (authError.message.toLowerCase().includes("already")) {
      throw new Error("Un compte existe déjà avec cet email.");
    }
    throw new Error(authError.message);
  }

  if (!authUser.user) {
    throw new Error("Échec de création du compte utilisateur.");
  }

  const userId = authUser.user.id;

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
      role: "admin",
    });

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (enabledModules.length > 0) {
      const { error: modulesError } = await db.from("organization_modules").upsert(
        enabledModules.map((module_name) => ({
          organization_id: org.id,
          module_name,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "organization_id,module_name" }
      );

      if (modulesError) {
        throw new Error(modulesError.message);
      }
    }

    if (input.aires && input.aires.length > 0) {
      await insertAiresForOrganization(org.id, input.aires);
    }

    return {
      organizationId: org.id,
      userId,
      managerEmail,
      enabledModules,
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
  for (const org of orgs) {
    const aires = await listAiresForOrganization(org.id);
    airesByOrg.set(org.id, aires);
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
