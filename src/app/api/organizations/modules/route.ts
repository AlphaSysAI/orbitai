// Copyright © 2026 OrbitSys. Tous droits réservés.

import { NextResponse } from "next/server";

import {
  authErrorToResponse,
  requireAuthUserFromRequest,
} from "@/server/auth/require-auth";
import {
  getEnabledModulesForUser,
  getPrimaryOrganizationForUser,
} from "@/lib/organizations/access";

/**
 * GET /api/organizations/modules
 * Modules activés pour l'organisation de l'utilisateur connecté.
 */
export async function GET(request: Request) {
  try {
    const user = await requireAuthUserFromRequest(request);
    const [organization, modules] = await Promise.all([
      getPrimaryOrganizationForUser(user.id),
      getEnabledModulesForUser(user.id),
    ]);

    return NextResponse.json({
      organization,
      modules: modules.map((m) => m.moduleName),
      enabledModules: modules,
    });
  } catch (error) {
    return authErrorToResponse(error);
  }
}
