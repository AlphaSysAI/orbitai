// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { formatOrgRoleLabel } from "@/lib/organizations/role-labels";
import {
  OrgContextError,
  requireOrgContext,
} from "@/lib/organizations/org-context";
import {
  createServerSupabaseClient,
  getAuthenticatedUser,
} from "@/server/auth/supabase-server";

export type CurrentUserProfile = {
  displayName: string;
  role: string;
  roleLabel: string;
  email: string | null;
  /** False pour les employés — pas d'identité affichée en évidence */
  showProfile: boolean;
};

export type GetCurrentUserProfileResult =
  | { success: true; data: CurrentUserProfile }
  | { success: false; error: string; code?: string };

export async function getCurrentUserProfile(): Promise<GetCurrentUserProfileResult> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { success: false, error: "Non authentifié", code: "unauthenticated" };
    }

    const ctx = await requireOrgContext();
    const supabase = await createServerSupabaseClient();
    const { data: authData } = await supabase.auth.getUser();
    const meta = authData.user?.user_metadata as
      | Record<string, unknown>
      | undefined;
    const firstName =
      typeof meta?.first_name === "string" ? meta.first_name.trim() : "";
    const lastName =
      typeof meta?.last_name === "string" ? meta.last_name.trim() : "";
    const fullName = `${firstName} ${lastName}`.trim();

    const displayName =
      fullName ||
      user.email?.split("@")[0] ||
      "Utilisateur";

    const role = ctx.role;
    const showProfile = role !== "employe";

    return {
      success: true,
      data: {
        displayName,
        role,
        roleLabel: formatOrgRoleLabel(role),
        email: user.email ?? null,
        showProfile,
      },
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur serveur" };
  }
}
