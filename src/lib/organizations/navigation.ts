// Copyright © 2026 OrbitSys. Tous droits réservés.

import type { LucideIcon } from "lucide-react";
import { Brain, LayoutDashboard, Truck, Users } from "lucide-react";

import type { RegiaireCapabilities } from "@/lib/regiaire/regiaire-capabilities";
import type { EnabledOrgModule } from "./types";
import { isModuleEnabled } from "./types";

export type StationNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredModule?: string;
  /** Segment de route sous /station/:aireId (ex. dashboard, deliveries) */
  routeSegment?: string;
};

/** Liens opérationnels sous une aire. */
export function buildStationNavLinks(aireId: string): StationNavLink[] {
  return [
    {
      href: `/station/${aireId}/dashboard`,
      label: "Accueil",
      icon: LayoutDashboard,
      requiredModule: "regiaire_core",
      routeSegment: "dashboard",
    },
    {
      href: `/station/${aireId}/deliveries`,
      label: "Réceptions",
      icon: Truck,
      requiredModule: "regiaire_core",
      routeSegment: "deliveries",
    },
    {
      href: `/station/${aireId}/equipe`,
      label: "Équipe",
      icon: Users,
      requiredModule: "regiaire_core",
      routeSegment: "equipe",
    },
    {
      href: `/station/${aireId}/verdict`,
      label: "Verdict",
      icon: Brain,
      requiredModule: "regiaire_core",
      routeSegment: "verdict",
    },
  ];
}

export function filterStationNavByCapabilities(
  links: StationNavLink[],
  caps: RegiaireCapabilities
): StationNavLink[] {
  return links.filter((link) => {
    switch (link.routeSegment) {
      case "dashboard":
        return caps.canViewAireDashboard;
      case "deliveries":
        return caps.canAccessReception;
      case "equipe":
        return caps.canAccessEquipe;
      case "verdict":
        return caps.canViewVerdict;
      default:
        return true;
    }
  });
}

/** @deprecated Utiliser buildStationNavLinks(aireId) */
export const STATION_NAV_LINKS: StationNavLink[] = buildStationNavLinks(
  "00000000-0000-0000-0000-000000000000"
);

export function filterNavLinksByModules(
  links: StationNavLink[],
  enabledModules: EnabledOrgModule[]
): StationNavLink[] {
  return links.filter((link) => {
    if (!link.requiredModule) return true;
    return isModuleEnabled(enabledModules, link.requiredModule);
  });
}

export function extractAireIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/station\/([0-9a-f-]{36})(?:\/|$)/i);
  return match?.[1] ?? null;
}
