// Copyright © 2026 OrbitSys. Tous droits réservés.

import type { RegiaireCapabilities } from "@/lib/regiaire/regiaire-capabilities";

export function defaultRegiaireLandingPath(
  aireId: string,
  caps: RegiaireCapabilities
): string {
  if (caps.canViewAireDashboard) {
    return `/station/${aireId}/dashboard`;
  }
  if (caps.canAccessReception) {
    return `/station/${aireId}/deliveries`;
  }
  if (caps.canAccessEquipe) {
    return `/station/${aireId}/equipe`;
  }
  return "/station";
}

export function isRegiairePathAllowed(
  pathname: string,
  aireId: string,
  caps: RegiaireCapabilities
): boolean {
  const base = `/station/${aireId}`;
  if (!pathname.startsWith(base)) return true;

  const rest = pathname.slice(base.length) || "/";

  if (rest === "/" || rest.startsWith("/dashboard")) {
    return caps.canViewAireDashboard;
  }
  if (rest.startsWith("/verdict")) {
    return caps.canViewVerdict;
  }
  if (rest.startsWith("/deliveries")) {
    return caps.canAccessReception;
  }
  if (rest.startsWith("/equipe/config")) {
    return caps.canManageShiftConfig;
  }
  if (rest.startsWith("/equipe/employes")) {
    return caps.canManageTeam;
  }
  if (rest.startsWith("/equipe")) {
    return caps.canAccessEquipe;
  }

  return true;
}
