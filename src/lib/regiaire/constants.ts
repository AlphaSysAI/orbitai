// Copyright © 2026 OrbitSys. Tous droits réservés.

/** Bucket Supabase Storage privé pour les bons de livraison RégiAire. */
export const REGIAIRE_BL_BUCKET = "regiaire-bl";

/** Préfixe de chemin org-scoped : bl/{organizationId}/{deliveryId}/… */
export const REGIAIRE_BL_PATH_PREFIX = "bl";

export function buildBlStoragePath(
  organizationId: string,
  deliveryId: string,
  fileName: string
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${REGIAIRE_BL_PATH_PREFIX}/${organizationId}/${deliveryId}/${Date.now()}-${safeName}`;
}
