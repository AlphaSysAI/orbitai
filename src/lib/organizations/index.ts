/**
 * Exports client-safe uniquement.
 * Côté serveur : importer depuis `@/lib/organizations/access`.
 */
export { ORG_MODULE_NAMES, type OrgModuleName, type EnabledOrgModule, type OrganizationSummary, isModuleEnabled } from "./types";

export type { StationNavLink } from "./navigation";
export { STATION_NAV_LINKS, filterNavLinksByModules } from "./navigation";
export { ORG_MODULE_CATALOG, VALID_MODULE_IDS, sanitizeModuleSelection } from "./module-catalog";
export type { OrgModuleCatalogEntry } from "./module-catalog";
