// Copyright © 2026 OrbitSys. Tous droits réservés.

import { ORG_MODULE_NAMES, type OrgModuleName } from "./types";

export type OrgModuleCatalogEntry = {
  id: OrgModuleName;
  label: string;
  description: string;
};

/** Catalogue des features activables par client (admin + checkboxes). */
export const ORG_MODULE_CATALOG: OrgModuleCatalogEntry[] = [
  {
    id: ORG_MODULE_NAMES.KNOWLEDGE_BASE,
    label: "Base de connaissances",
    description: "Centralisation et recherche documentaire.",
  },
  {
    id: ORG_MODULE_NAMES.COPILOT,
    label: "Copilote IA & Transmission",
    description: "Assistant IA, RAG et révisions humaines.",
  },
  {
    id: ORG_MODULE_NAMES.AUTOMATION,
    label: "Détection & Automatisation",
    description: "Tâches grises et automatisations.",
  },
  {
    id: ORG_MODULE_NAMES.DECISION,
    label: "Simulation décisionnelle",
    description: "Scénarios et aide à la décision.",
  },
  {
    id: ORG_MODULE_NAMES.CLIENT,
    label: "Synthèse intelligente client",
    description: "Retours clients et analyses marketing.",
  },
  {
    id: ORG_MODULE_NAMES.REGIAIRE_CORE,
    label: "Orbit Aire",
    description: "Gestion de station-service (livraisons, stocks, équipes).",
  },
  {
    id: ORG_MODULE_NAMES.ARTISAN_CORE,
    label: "Orbit Artisan",
    description: "Devis et factures boostés à l'IA (demande client écrite ou vocale, devis validé par l'artisan).",
  },
  {
    id: ORG_MODULE_NAMES.HOTEL_CORE,
    label: "Orbit Hôtel",
    description: "Orchestration IA des logiciels de l'hôtel (réservation → commande en chambre, serveur vocal IA à terme).",
  },
];

export const VALID_MODULE_IDS = new Set<string>(
  ORG_MODULE_CATALOG.map((m) => m.id)
);

export function sanitizeModuleSelection(moduleNames: string[]): OrgModuleName[] {
  return moduleNames.filter((name): name is OrgModuleName => VALID_MODULE_IDS.has(name));
}
