import type { LucideIcon } from "lucide-react";
import { Package, Truck, Users } from "lucide-react";

import type { EnabledOrgModule } from "./types";
import { isModuleEnabled } from "./types";

export type StationNavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  requiredModule?: string;
};

/** Liens RégiAire — affichés dans la sidebar si le module est activé. */
export const STATION_NAV_LINKS: StationNavLink[] = [
  {
    href: "/station/deliveries",
    label: "Réceptions",
    icon: Truck,
    requiredModule: "regiaire_core",
  },
  {
    href: "/station/stocks",
    label: "Stocks",
    icon: Package,
    requiredModule: "regiaire_core",
  },
  {
    href: "/station/teams",
    label: "Équipes & check-lists",
    icon: Users,
    requiredModule: "regiaire_core",
  },
];

export function filterNavLinksByModules(
  links: StationNavLink[],
  enabledModules: EnabledOrgModule[]
): StationNavLink[] {
  return links.filter((link) => {
    if (!link.requiredModule) return true;
    return isModuleEnabled(enabledModules, link.requiredModule);
  });
}
