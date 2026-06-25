// Copyright © 2026 OrbitSys. Tous droits réservés.

import {
  ORG_MODULE_NAMES,
  isModuleEnabled,
  type EnabledOrgModule,
  type OrgModuleName,
} from "@/lib/organizations/types";

export type SaasBrandPart = {
  text: string;
  /** Segment « iA » en violet OrbitAI */
  highlight?: boolean;
};

export type SaasBrand = {
  moduleId: OrgModuleName;
  parts: SaasBrandPart[];
  dashboardTitle: string;
};

const SAAS_BRANDS: Partial<Record<OrgModuleName, SaasBrand>> = {
  [ORG_MODULE_NAMES.REGIAIRE_CORE]: {
    moduleId: ORG_MODULE_NAMES.REGIAIRE_CORE,
    parts: [
      { text: "Rég" },
      { text: "iA", highlight: true },
      { text: "ire" },
    ],
    dashboardTitle: "Dashboard station",
  },
  [ORG_MODULE_NAMES.ARTISAN_CORE]: {
    moduleId: ORG_MODULE_NAMES.ARTISAN_CORE,
    parts: [
      { text: "Art" },
      { text: "iA", highlight: true },
      { text: "san" },
    ],
    dashboardTitle: "Dashboard artisan",
  },
  [ORG_MODULE_NAMES.HOTEL_CORE]: {
    moduleId: ORG_MODULE_NAMES.HOTEL_CORE,
    parts: [
      { text: "Hôt" },
      { text: "iA", highlight: true },
      { text: "l" },
    ],
    dashboardTitle: "Dashboard hôtel",
  },
};

/** Modules métier vertical (priorité d'affichage dashboard). */
const VERTICAL_MODULE_PRIORITY: OrgModuleName[] = [
  ORG_MODULE_NAMES.REGIAIRE_CORE,
  ORG_MODULE_NAMES.ARTISAN_CORE,
  ORG_MODULE_NAMES.HOTEL_CORE,
];

const FALLBACK_BRAND: SaasBrand = {
  moduleId: ORG_MODULE_NAMES.KNOWLEDGE_BASE,
  parts: [{ text: "Orbit" }, { text: "iA", highlight: true }],
  dashboardTitle: "Dashboard",
};

export function getPrimaryBusinessModule(
  enabledModules: EnabledOrgModule[]
): OrgModuleName | null {
  for (const moduleId of VERTICAL_MODULE_PRIORITY) {
    if (isModuleEnabled(enabledModules, moduleId)) {
      return moduleId;
    }
  }
  return null;
}

export function getSaasBrand(
  moduleId: OrgModuleName | null | undefined
): SaasBrand {
  if (moduleId && SAAS_BRANDS[moduleId]) {
    return SAAS_BRANDS[moduleId]!;
  }
  return FALLBACK_BRAND;
}

export function resolveSaasBrandFromModules(
  enabledModules: EnabledOrgModule[]
): SaasBrand {
  return getSaasBrand(getPrimaryBusinessModule(enabledModules));
}
