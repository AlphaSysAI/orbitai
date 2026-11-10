// Copyright © 2026 OrbitSys. Tous droits réservés.

/**
 * Catalogue des features vendables « à la carte ».
 *
 * Chaque entrée est un module activable par organisation : son `id` est stocké
 * dans `organization_modules.module_name` et contrôle l'accès (RPC `org_has_module`).
 * Ce catalogue alimente : le dashboard utilisateur (vitrine + abonnement), le
 * dashboard admin (activation manuelle) et Stripe (un produit/prix par feature).
 *
 * Les prix sont indicatifs (modifiables) et exprimés en euros/mois HT par organisation.
 */

export type FeatureGroup = "aire" | "hotel" | "addon";

export type FeatureDef = {
  /** module_name stocké en base (organization_modules). */
  id: string;
  group: FeatureGroup;
  label: string;
  /** Accroche courte (une ligne). */
  tagline: string;
  /** Description détaillée pour la carte du catalogue. */
  description: string;
  /** Points clés affichés en liste. */
  highlights: string[];
  /** Prix indicatif €/mois HT par organisation. */
  priceEurMonthly: number;
  /** Nom d'icône lucide-react (visuel de la carte). */
  icon: string;
  /** Classe de couleur d'accent (Tailwind). */
  accent: string;
};

export const FEATURE_GROUPS: Record<FeatureGroup, { label: string; brand: string }> = {
  aire: { label: "Orbit Aire", brand: "Stations-service" },
  hotel: { label: "Orbit Hôtel", brand: "Hôtellerie" },
  addon: { label: "Add-ons IA", brand: "Transverses" },
};

export const FEATURE_CATALOG: FeatureDef[] = [
  // ─── Orbit Aire ───────────────────────────────────────────────────────────
  {
    id: "aire_reception",
    group: "aire",
    label: "Réception & Stock",
    tagline: "Bons de livraison, scan EAN et stock par lots.",
    description:
      "Réception des bons de livraison avec extraction par IA, scan EAN au mobile, suivi du stock par lots et alertes de dates limites (DLC).",
    highlights: ["Upload BL + extraction IA", "Scan EAN mobile", "Stock par lots & DLC", "Mode hors-ligne"],
    priceEurMonthly: 79,
    icon: "PackageCheck",
    accent: "text-amber-400",
  },
  {
    id: "aire_equipe",
    group: "aire",
    label: "Équipes & Quarts",
    tagline: "Passation de quart, checklist et historique.",
    description:
      "Gestion opérationnelle des équipes : passation de quart, checklist de tâches, clôture avec consignes, historique et membres d'aire.",
    highlights: ["Passation de quart", "Checklist de tâches", "Clôture & consignes", "Employés d'aire"],
    priceEurMonthly: 39,
    icon: "Users",
    accent: "text-amber-400",
  },
  {
    id: "aire_verdict",
    group: "aire",
    label: "Verdict IA",
    tagline: "Recommandation merchandising quotidienne.",
    description:
      "Synthèse IA des signaux du jour (météo, vacances, trafic, Bison Futé, tendances) en une recommandation merchandising et affluence actionnable.",
    highlights: ["Signaux agrégés", "Recommandation GPT-4o", "Alertes périmés", "Cache quotidien"],
    priceEurMonthly: 49,
    icon: "Sparkles",
    accent: "text-amber-400",
  },
  {
    id: "aire_reappro",
    group: "aire",
    label: "Réapprovisionnement",
    tagline: "Plan de commande en unités.",
    description:
      "Moteur de réapprovisionnement : projection de la demande, multiplicateurs d'affluence (chaleur, vacances, trafic) et plan de commande conseillé.",
    highlights: ["Projection de demande", "Multiplicateurs d'affluence", "Date de commande conseillée"],
    priceEurMonthly: 39,
    icon: "TrendingUp",
    accent: "text-amber-400",
  },
  // ─── Orbit Hôtel ──────────────────────────────────────────────────────────
  {
    id: "hotel_reservations",
    group: "hotel",
    label: "Réservations & Planning",
    tagline: "Réservations, chambres et planning d'occupation.",
    description:
      "Gestion des réservations, attribution de chambre, inventaire anti-surbooking et planning d'occupation en temps réel.",
    highlights: ["Réservations", "Planning d'occupation", "Inventaire anti-surbooking"],
    priceEurMonthly: 89,
    icon: "CalendarCheck",
    accent: "text-sky-400",
  },
  {
    id: "hotel_rates",
    group: "hotel",
    label: "Tarifs & Yield",
    tagline: "Plans tarifaires et calendrier de prix.",
    description:
      "Plans tarifaires et calendrier de prix dynamique pour optimiser le revenu par chambre.",
    highlights: ["Plans tarifaires", "Calendrier de prix", "Yield"],
    priceEurMonthly: 49,
    icon: "BadgeEuro",
    accent: "text-sky-400",
  },
  {
    id: "hotel_billing",
    group: "hotel",
    label: "Facturation",
    tagline: "Factures, encaissements et taxe de séjour.",
    description:
      "Facturation hôtelière : génération de factures, encaissements et taxe de séjour configurable.",
    highlights: ["Factures", "Encaissements", "Taxe de séjour"],
    priceEurMonthly: 39,
    icon: "ReceiptText",
    accent: "text-sky-400",
  },
  {
    id: "hotel_voice",
    group: "hotel",
    label: "Serveur vocal IA",
    tagline: "Répond, renseigne et réserve au téléphone 24/7.",
    description:
      "Agent vocal IA (ElevenLabs) qui répond au téléphone, renseigne les disponibilités et réserve directement une chambre, 24/7.",
    highlights: ["Réponse 24/7", "Disponibilités en direct", "Réservation vocale"],
    priceEurMonthly: 99,
    icon: "PhoneCall",
    accent: "text-sky-400",
  },
  // ─── Add-ons IA transverses ───────────────────────────────────────────────
  {
    id: "copilot-transmission",
    group: "addon",
    label: "Copilote & Transmission",
    tagline: "Assistant RAG sur vos documents.",
    description:
      "Assistant IA type RAG : recherche et chat sur vos documents, avec revue humaine.",
    highlights: ["Recherche documentaire", "Chat IA", "Revue humaine"],
    priceEurMonthly: 29,
    icon: "MessagesSquare",
    accent: "text-teal-400",
  },
  {
    id: "detection-automation",
    group: "addon",
    label: "Détection & Automatisation",
    tagline: "Repère les tâches à faible valeur.",
    description:
      "Détecte les tâches répétitives automatisables et suit l'activité pour prioriser l'automatisation.",
    highlights: ["Détection de tâches", "Suivi d'activité", "Automatisations"],
    priceEurMonthly: 29,
    icon: "Workflow",
    accent: "text-teal-400",
  },
  {
    id: "decision-simulation",
    group: "addon",
    label: "Simulation décisionnelle",
    tagline: "Scénarios stratégiques chiffrés.",
    description:
      "Explore des scénarios stratégiques et chiffre les options pour éclairer une décision.",
    highlights: ["Scénarios", "Chiffrage", "Recommandation"],
    priceEurMonthly: 29,
    icon: "GitBranch",
    accent: "text-teal-400",
  },
  {
    id: "client-synthesis",
    group: "addon",
    label: "Synthèse client",
    tagline: "Analyse des retours clients.",
    description:
      "Agrège et analyse les retours clients et la veille marketing en synthèses actionnables.",
    highlights: ["Agrégation des retours", "Analyse IA", "Veille marketing"],
    priceEurMonthly: 29,
    icon: "HeartHandshake",
    accent: "text-teal-400",
  },
];

export const FEATURE_BY_ID: Record<string, FeatureDef> = Object.fromEntries(
  FEATURE_CATALOG.map((f) => [f.id, f])
);

/** Ensemble des ids de features vendables (pour validation). */
export const SELLABLE_FEATURE_IDS = new Set(FEATURE_CATALOG.map((f) => f.id));

/** Modules « Orbit Aire » : donnent accès à l'espace station. */
export const AIRE_FEATURE_IDS = FEATURE_CATALOG.filter((f) => f.group === "aire").map((f) => f.id);

/** Modules « Orbit Hôtel » : donnent accès à l'espace hôtel. */
export const HOTEL_FEATURE_IDS = FEATURE_CATALOG.filter((f) => f.group === "hotel").map((f) => f.id);

export function featuresByGroup(group: FeatureGroup): FeatureDef[] {
  return FEATURE_CATALOG.filter((f) => f.group === group);
}

/**
 * Module « parapluie » à activer en plus d'une sous-feature, pour conserver le
 * contrôle d'accès existant (l'espace station gate sur `regiaire_core`, l'espace
 * hôtel sur `hotel_core`). Les add-ons se contrôlent sur leur propre id.
 *
 * Ainsi, s'abonner à une sous-feature Aire/Hôtel ouvre l'espace correspondant,
 * sans re-gater page par page (affinage fin possible ultérieurement).
 */
export function umbrellaModuleFor(featureId: string): string | null {
  const f = FEATURE_BY_ID[featureId];
  if (!f) return null;
  if (f.group === "aire") return "regiaire_core";
  if (f.group === "hotel") return "hotel_core";
  return null;
}

/** Tous les module_name à activer pour une liste de features (sous-features + parapluies). */
export function expandModulesForFeatures(featureIds: string[]): string[] {
  const set = new Set<string>();
  for (const id of featureIds) {
    if (!SELLABLE_FEATURE_IDS.has(id)) continue;
    set.add(id);
    const umbrella = umbrellaModuleFor(id);
    if (umbrella) set.add(umbrella);
  }
  return Array.from(set);
}
