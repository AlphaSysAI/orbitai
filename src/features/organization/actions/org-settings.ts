"use server";

import {
  OrgContextError,
  requireOrgAdminContext,
  requireOrgContext,
} from "@/lib/organizations/org-context";
import {
  createOrgMemberUser,
  type CreateOrgMemberResult,
} from "@/lib/organizations/create-org-member";

export type OrgProfile = {
  id: string;
  name: string;
  managerFirstName: string | null;
  managerLastName: string | null;
  managerEmail: string | null;
  businessSector: string | null;
};

export type OrgMemberListItem = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
};

export type GetOrgSettingsResult =
  | {
      success: true;
      data: {
        profile: OrgProfile;
        members: OrgMemberListItem[];
        role: string;
        isOrgAdmin: boolean;
      };
    }
  | { success: false; error: string; code?: string };

export type UpdateOrgProfileResult =
  | { success: true; data: OrgProfile }
  | { success: false; error: string; code?: string };

export type CreateOrgMemberActionResult =
  | { success: true; data: CreateOrgMemberResult }
  | { success: false; error: string; code?: string };

export type GetOrgRoleResult =
  | { success: true; role: string; isOrgAdmin: boolean }
  | { success: false; error: string; code?: string };

export async function getOrgRole(): Promise<GetOrgRoleResult> {
  try {
    const ctx = await requireOrgContext();
    return {
      success: true,
      role: ctx.role,
      isOrgAdmin: ctx.isOrgAdmin,
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur serveur" };
  }
}

export async function getOrgSettings(): Promise<GetOrgSettingsResult> {
  try {
    const ctx = await requireOrgAdminContext();

    const { data: org, error: orgError } = await ctx.db
      .from("organizations")
      .select(
        "id, name, manager_first_name, manager_last_name, manager_email, business_sector"
      )
      .eq("id", ctx.organizationId)
      .single();

    if (orgError || !org) {
      return { success: false, error: orgError?.message ?? "Organisation introuvable" };
    }

    const { data: membersRaw, error: membersError } = await ctx.db
      .from("organization_members")
      .select("id, user_id, role, created_at")
      .eq("organization_id", ctx.organizationId)
      .order("created_at", { ascending: true });

    if (membersError) {
      return { success: false, error: membersError.message };
    }

    const profile: OrgProfile = {
      id: org.id,
      name: org.name,
      managerFirstName: org.manager_first_name,
      managerLastName: org.manager_last_name,
      managerEmail: org.manager_email,
      businessSector: org.business_sector,
    };

    const members: OrgMemberListItem[] = (membersRaw ?? []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      role: m.role as string,
      createdAt: m.created_at,
    }));

    return {
      success: true,
      data: {
        profile,
        members,
        role: ctx.role,
        isOrgAdmin: ctx.isOrgAdmin,
      },
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors du chargement" };
  }
}

export async function updateOrgProfile(input: {
  name: string;
  managerFirstName: string;
  managerLastName: string;
  managerEmail: string;
  businessSector: string;
}): Promise<UpdateOrgProfileResult> {
  try {
    const ctx = await requireOrgAdminContext();

    const name = input.name.trim();
    const managerFirstName = input.managerFirstName.trim();
    const managerLastName = input.managerLastName.trim();
    const managerEmail = input.managerEmail.trim().toLowerCase();
    const businessSector = input.businessSector.trim();

    if (!name || !managerFirstName || !managerLastName || !managerEmail || !businessSector) {
      return { success: false, error: "Tous les champs sont obligatoires." };
    }

    const { data, error } = await ctx.db
      .from("organizations")
      .update({
        name,
        manager_first_name: managerFirstName,
        manager_last_name: managerLastName,
        manager_email: managerEmail,
        business_sector: businessSector,
      })
      .eq("id", ctx.organizationId)
      .select(
        "id, name, manager_first_name, manager_last_name, manager_email, business_sector"
      )
      .single();

    if (error || !data) {
      return { success: false, error: error?.message ?? "Mise à jour impossible" };
    }

    return {
      success: true,
      data: {
        id: data.id,
        name: data.name,
        managerFirstName: data.manager_first_name,
        managerLastName: data.manager_last_name,
        managerEmail: data.manager_email,
        businessSector: data.business_sector,
      },
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

export async function createOrgMember(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<CreateOrgMemberActionResult> {
  try {
    const ctx = await requireOrgAdminContext();

    const result = await createOrgMemberUser({
      organizationId: ctx.organizationId,
      email: input.email,
      password: input.password,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    const message =
      error instanceof Error ? error.message : "Erreur lors de la création";
    return { success: false, error: message };
  }
}
