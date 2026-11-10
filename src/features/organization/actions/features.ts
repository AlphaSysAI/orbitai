// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import {
  requireOrgContext,
  requireOrgAdminContext,
  OrgContextError,
} from "@/lib/organizations/org-context";
import {
  FEATURE_CATALOG,
  SELLABLE_FEATURE_IDS,
} from "@/lib/organizations/feature-catalog";
import { setOrganizationModules } from "@/lib/organizations/set-modules";

export type OrgFeatureState = {
  isOrgAdmin: boolean;
  /** Ensemble des ids de features actuellement actives pour l'organisation. */
  enabledFeatureIds: string[];
};

export type GetOrgFeatureStateResult =
  | { success: true; data: OrgFeatureState }
  | { success: false; error: string; code?: string };

/** État d'abonnement de l'organisation de l'utilisateur courant. */
export async function getOrgFeatureState(): Promise<GetOrgFeatureStateResult> {
  try {
    const ctx = await requireOrgContext();
    const { data, error } = await ctx.db
      .from("organization_modules")
      .select("module_name, is_enabled")
      .eq("organization_id", ctx.organizationId);

    if (error) return { success: false, error: error.message };

    const enabled = new Set(
      (data ?? [])
        .filter((r) => r.is_enabled)
        .map((r) => r.module_name as string)
    );

    return {
      success: true,
      data: {
        isOrgAdmin: ctx.isOrgAdmin,
        enabledFeatureIds: FEATURE_CATALOG.map((f) => f.id).filter((id) =>
          enabled.has(id)
        ),
      },
    };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    console.error("[getOrgFeatureState] échec:", error);
    return { success: false, error: "Erreur de chargement" };
  }
}

export type SetFeatureResult =
  | { success: true; enabledFeatureIds: string[] }
  | { success: false; error: string; code?: string };

/**
 * Active ou désactive une feature pour l'organisation (réservé aux admins org).
 *
 * Activation automatisée par Stripe à terme (webhook) ; cette action sert à
 * l'activation manuelle (admin / tests). Gère le module « parapluie » :
 * l'espace reste ouvert tant qu'au moins une sous-feature du groupe est active.
 */
export async function setOrgFeatureEnabled(
  featureId: string,
  enabled: boolean
): Promise<SetFeatureResult> {
  try {
    if (!SELLABLE_FEATURE_IDS.has(featureId)) {
      return { success: false, error: "Feature inconnue" };
    }
    const ctx = await requireOrgAdminContext();
    const result = await setOrganizationModules(ctx.db, ctx.organizationId, {
      [featureId]: enabled,
    });
    return { success: true, enabledFeatureIds: result };
  } catch (error) {
    if (error instanceof OrgContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    console.error("[setOrgFeatureEnabled] échec:", error);
    return { success: false, error: "Erreur serveur" };
  }
}
