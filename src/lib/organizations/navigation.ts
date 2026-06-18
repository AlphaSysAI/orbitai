import type { LucideIcon } from "lucide-react";
import { Brain, LayoutDashboard, Truck, Users } from "lucide-react";

import type { EnabledOrgModule } from "./types";
import { isModuleEnabled } from "./types";

export type StationNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredModule?: string;
};

/** Liens opérationnels sous une aire. */
export function buildStationNavLinks(aireId: string): StationNavLink[] {
  return [
    {
      href: `/station/${aireId}/dashboard`,
      label: "Accueil",
      icon: LayoutDashboard,
      requiredModule: "regiaire_core",
    },
    {
      href: `/station/${aireId}/deliveries`,
      label: "Réceptions",
      icon: Truck,
      requiredModule: "regiaire_core",
    },
    {
      href: `/station/${aireId}/equipe`,
      label: "Équipe",
      icon: Users,
      requiredModule: "regiaire_core",
    },
    {
      href: `/station/${aireId}/verdict`,
      label: "Verdict",
      icon: Brain,
      requiredModule: "regiaire_core",
    },
  ];
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
