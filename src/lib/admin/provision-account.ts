// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";
import { createOrInviteAuthUser } from "@/lib/admin/auth-provision";
import {
  provisionClient,
  type ProvisionClientInput,
} from "@/lib/admin/provision-client";

// ─── Rôles hiérarchie ────────────────────────────────────────────────────

export const HIERARCHY_ROLES = [
  "direction_france",
  "directeur_region",
  "chef_secteur",
  "gerant",
] as const;

export type HierarchyRole = (typeof HIERARCHY_ROLES)[number];

// ─── Service client ──────────────────────────────────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

function getInviteRedirect() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", ".vercel.app") ??
    "http://localhost:3000";
  return `${siteUrl}/auth/callback?next=/auth/set-password`;
}

// ─── Inputs ──────────────────────────────────────────────────────────────

type IdentityInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
};

export type ProvisionAccountInput =
  | ({ role: "direction_france" } & ProvisionClientInput)
  | ({ role: "directeur_region"; organizationId: string } & IdentityInput)
  | ({
      role: "chef_secteur";
      organizationId: string;
      parentRegionalUserId: string;
      secteurName: string;
      aireIds: string[];
    } & IdentityInput)
  | ({
      role: "gerant";
      organizationId: string;
      parentChefUserId: string;
      aireIds: string[];
    } & IdentityInput);

export type ProvisionAccountResult = {
  userId: string;
  email: string;
  role: HierarchyRole;
  organizationId: string;
  tempPassword?: string;
};

// ─── Helper : invite + membership + profil ───────────────────────────────

async function inviteHierarchyUser(
  identity: IdentityInput,
  organizationId: string,
  role: HierarchyRole
): Promise<{ userId: string; email: string; tempPassword?: string }> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const email = identity.email.trim().toLowerCase();
  const firstName = identity.firstName.trim();
  const lastName = identity.lastName.trim();

  if (!email || !firstName || !lastName) {
    throw new Error("Prénom, nom et email sont obligatoires.");
  }

  const { userId, tempPassword } = await createOrInviteAuthUser(admin, {
    email,
    firstName,
    lastName,
    redirectTo: getInviteRedirect(),
  });

  try {
    const { error: memberError } = await db
      .from("organization_members")
      .insert({ organization_id: organizationId, user_id: userId, role });
    if (memberError) throw new Error(memberError.message);

    const { error: profileError } = await db
      .from("org_member_profiles")
      .insert({
        user_id: userId,
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: identity.phone?.trim() || null,
      });
    if (profileError) throw new Error(profileError.message);

    return { userId, email, tempPassword };
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }
}

async function findDirectionFranceUser(
  organizationId: string
): Promise<string | null> {
  const db = forWrite(getServiceClient());
  const { data } = await db
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .in("role", ["direction_france", "admin", "owner"])
    .limit(1)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function linkHierarchy(
  organizationId: string,
  managerUserId: string,
  subordinateUserId: string
): Promise<void> {
  const db = forWrite(getServiceClient());
  await db.from("org_hierarchy_links").insert({
    organization_id: organizationId,
    manager_user_id: managerUserId,
    subordinate_user_id: subordinateUserId,
  });
}

// ─── Données hiérarchie pour les sélecteurs du formulaire ────────────────

export type OrgHierarchyData = {
  regionals: { userId: string; name: string }[];
  chefs: { userId: string; name: string; secteurId: string | null; secteurName: string | null }[];
  aires: { id: string; name: string; city: string | null; secteurId: string | null }[];
};

export async function getOrgHierarchyData(
  organizationId: string
): Promise<OrgHierarchyData> {
  const db = forWrite(getServiceClient());

  const [{ data: members }, { data: profiles }, { data: secteurs }, { data: aires }] =
    await Promise.all([
      db
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", organizationId)
        .in("role", ["directeur_region", "chef_secteur"]),
      db
        .from("org_member_profiles")
        .select("user_id, first_name, last_name")
        .eq("organization_id", organizationId),
      db
        .from("secteurs")
        .select("id, name, chef_user_id")
        .eq("organization_id", organizationId),
      db
        .from("aires")
        .select("id, name, city, secteur_id")
        .eq("organization_id", organizationId),
    ]);

  const nameOf = (userId: string) => {
    const p = (profiles ?? []).find((x) => x.user_id === userId);
    return p ? `${p.first_name} ${p.last_name}` : userId.slice(0, 8);
  };

  const regionals = (members ?? [])
    .filter((m) => m.role === "directeur_region")
    .map((m) => ({ userId: m.user_id as string, name: nameOf(m.user_id as string) }));

  const chefs = (members ?? [])
    .filter((m) => m.role === "chef_secteur")
    .map((m) => {
      const secteur = (secteurs ?? []).find((s) => s.chef_user_id === m.user_id);
      return {
        userId: m.user_id as string,
        name: nameOf(m.user_id as string),
        secteurId: (secteur?.id as string | undefined) ?? null,
        secteurName: (secteur?.name as string | undefined) ?? null,
      };
    });

  const airesList = (aires ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    city: (a.city as string | null) ?? null,
    secteurId: (a.secteur_id as string | null) ?? null,
  }));

  return { regionals, chefs, aires: airesList };
}

// ─── Dispatcher ──────────────────────────────────────────────────────────

export async function provisionAccount(
  input: ProvisionAccountInput
): Promise<ProvisionAccountResult> {
  switch (input.role) {
    case "direction_france": {
      // Crée l'org + le compte au sommet (réutilise provisionClient, rôle ajusté).
      const result = await provisionClient(input, "direction_france");
      const db = forWrite(getServiceClient());
      await db.from("org_member_profiles").insert({
        user_id: result.userId,
        organization_id: result.organizationId,
        first_name: input.managerFirstName.trim(),
        last_name: input.managerLastName.trim(),
        email: result.managerEmail,
        phone: null,
      });
      return {
        userId: result.userId,
        email: result.managerEmail,
        role: "direction_france",
        organizationId: result.organizationId,
        tempPassword: result.tempPassword,
      };
    }

    case "directeur_region": {
      const { userId, email, tempPassword } = await inviteHierarchyUser(
        input,
        input.organizationId,
        "directeur_region"
      );
      const directionUser = await findDirectionFranceUser(input.organizationId);
      if (directionUser) {
        await linkHierarchy(input.organizationId, directionUser, userId);
      }
      return {
        userId,
        email,
        role: "directeur_region",
        organizationId: input.organizationId,
        tempPassword,
      };
    }

    case "chef_secteur": {
      const { userId, email, tempPassword } = await inviteHierarchyUser(
        input,
        input.organizationId,
        "chef_secteur"
      );
      const db = forWrite(getServiceClient());

      const { data: secteur, error: secteurError } = await db
        .from("secteurs")
        .insert({
          organization_id: input.organizationId,
          name: input.secteurName.trim() || `Secteur ${input.lastName.trim()}`,
          chef_user_id: userId,
        })
        .select("id")
        .single();

      if (secteurError || !secteur) {
        throw new Error(secteurError?.message ?? "Échec création secteur");
      }

      if (input.aireIds.length > 0) {
        await db
          .from("aires")
          .update({ secteur_id: secteur.id })
          .in("id", input.aireIds)
          .eq("organization_id", input.organizationId);
      }

      await linkHierarchy(input.organizationId, input.parentRegionalUserId, userId);

      return {
        userId,
        email,
        role: "chef_secteur",
        organizationId: input.organizationId,
        tempPassword,
      };
    }

    case "gerant": {
      const { userId, email, tempPassword } = await inviteHierarchyUser(
        input,
        input.organizationId,
        "gerant"
      );
      await linkHierarchy(input.organizationId, input.parentChefUserId, userId);

      if (input.aireIds.length > 0) {
        const db = forWrite(getServiceClient());
        await db.from("gerant_aires").insert(
          input.aireIds.map((aireId) => ({
            gerant_user_id: userId,
            aire_id: aireId,
            organization_id: input.organizationId,
          }))
        );
      }

      return {
        userId,
        email,
        role: "gerant",
        organizationId: input.organizationId,
        tempPassword,
      };
    }
  }
}
