/**
 * Aire de référence pour les tests manuels et seeds démo (OrbitAI / RégiAire).
 * Seed : database/seeds/017_regiaire_arzens_demo.sql
 */
export const REGIAIRE_DEMO_AIRE_ID = "7ec3c50b-4893-4904-90d2-56e0ab04532a" as const;

export const REGIAIRE_DEMO_ORG_ID =
  "bba39426-6f78-4750-a77a-f5c0c991a878" as const;

export const REGIAIRE_DEMO_AIRE_NAME = "Aire Arzens SUD";

/** Chemin dashboard pour tests rapides */
export function regiaireDemoDashboardPath(): string {
  return `/station/${REGIAIRE_DEMO_AIRE_ID}/dashboard`;
}

export function regiaireDemoVerdictPath(): string {
  return `/station/${REGIAIRE_DEMO_AIRE_ID}/verdict`;
}
