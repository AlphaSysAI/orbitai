/**
 * Identifiants de modules activables par organisation.
 */
export const ORG_MODULE_NAMES = {
  KNOWLEDGE_BASE: "knowledge_base",
  REGIAIRE_CORE: "regiaire_core",
  ARTISAN_CORE: "artisan_core",
  HOTEL_CORE: "hotel_core",
  COPILOT: "copilot-transmission",
  AUTOMATION: "detection-automation",
  DECISION: "decision-simulation",
  CLIENT: "client-synthesis",
} as const;

export type OrgModuleName = (typeof ORG_MODULE_NAMES)[keyof typeof ORG_MODULE_NAMES];

export interface OrganizationSummary {
  id: string;
  name: string;
}

export interface EnabledOrgModule {
  organizationId: string;
  moduleName: string;
}

export function isModuleEnabled(
  modules: EnabledOrgModule[],
  moduleName: string
): boolean {
  return modules.some((m) => m.moduleName === moduleName);
}
