// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import {
  canManageAireTeam,
  canManageShiftOnAire,
  getMembershipRole,
  isGerantOfAire,
} from "@/lib/regiaire/aire-scope";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

export type RegiaireCapabilities = {
  role: string;
  /** Accueil aire (KPIs, modules) */
  canViewAireDashboard: boolean;
  canViewVerdict: boolean;
  canAccessReception: boolean;
  canAccessEquipe: boolean;
  canManageShiftConfig: boolean;
  canManageTeam: boolean;
  isShiftManager: boolean;
};

const ORG_WIDE_MANAGER_ROLES = new Set([
  "owner",
  "admin",
  "direction_france",
]);

export async function resolveRegiaireCapabilities(
  ctx: RegiaireContext
): Promise<RegiaireCapabilities> {
  const role =
    (await getMembershipRole(ctx.db, ctx.organizationId, ctx.userId)) ?? "member";

  if (role === "employe") {
    return {
      role,
      canViewAireDashboard: false,
      canViewVerdict: false,
      canAccessReception: true,
      canAccessEquipe: true,
      canManageShiftConfig: false,
      canManageTeam: false,
      isShiftManager: false,
    };
  }

  const isOrgManager = ORG_WIDE_MANAGER_ROLES.has(role);
  const isGerant =
    role === "gerant" && (await isGerantOfAire(ctx.db, ctx.userId, ctx.aireId));
  const canManageShift = await canManageShiftOnAire(ctx);
  const canManageTeam = await canManageAireTeam(ctx);

  return {
    role,
    canViewAireDashboard: true,
    canViewVerdict: isOrgManager || isGerant || role === "chef_secteur" || role === "directeur_region",
    canAccessReception: true,
    canAccessEquipe: true,
    canManageShiftConfig: canManageShift,
    canManageTeam: canManageTeam,
    isShiftManager: canManageShift,
  };
}
