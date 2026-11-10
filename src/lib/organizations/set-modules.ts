// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FEATURE_CATALOG,
  SELLABLE_FEATURE_IDS,
} from "@/lib/organizations/feature-catalog";

const UMBRELLA_MODULES = ["regiaire_core", "hotel_core"] as const;

/** Tous les module_name gérés par le catalogue (sous-features + parapluies). */
const MANAGED_MODULES = [
  ...FEATURE_CATALOG.map((f) => f.id),
  ...UMBRELLA_MODULES,
];

/**
 * Applique des changements d'activation de features à une organisation et
 * recalcule les modules « parapluie » (`regiaire_core` actif ssi ≥1 feature
 * Orbit Aire active, idem `hotel_core`).
 *
 * Logique d'activation unique, partagée par : l'activation manuelle (admin /
 * dashboard user) et, à terme, le webhook Stripe.
 *
 * @param changes  map { featureId: enabled } — uniquement des features vendables.
 * @returns la liste des ids de features vendables actives après application.
 */
export async function setOrganizationModules(
  db: SupabaseClient,
  organizationId: string,
  changes: Record<string, boolean>
): Promise<string[]> {
  // 1. État courant.
  const { data, error: readError } = await db
    .from("organization_modules")
    .select("module_name, is_enabled")
    .eq("organization_id", organizationId);
  if (readError) throw new Error(readError.message);

  const enabled = new Set(
    (data ?? [])
      .filter((r: { is_enabled: boolean }) => r.is_enabled)
      .map((r: { module_name: string }) => r.module_name)
  );

  // 2. Applique les changements sur les sous-features vendables.
  for (const [id, on] of Object.entries(changes)) {
    if (!SELLABLE_FEATURE_IDS.has(id)) continue;
    if (on) enabled.add(id);
    else enabled.delete(id);
  }

  // 3. Recalcule les parapluies.
  const aireActive = FEATURE_CATALOG.some(
    (f) => f.group === "aire" && enabled.has(f.id)
  );
  const hotelActive = FEATURE_CATALOG.some(
    (f) => f.group === "hotel" && enabled.has(f.id)
  );
  if (aireActive) enabled.add("regiaire_core");
  else enabled.delete("regiaire_core");
  if (hotelActive) enabled.add("hotel_core");
  else enabled.delete("hotel_core");

  // 4. Persiste l'état de tous les modules gérés (idempotent).
  const now = new Date().toISOString();
  const rows = MANAGED_MODULES.map((module_name) => ({
    organization_id: organizationId,
    module_name,
    is_enabled: enabled.has(module_name),
    updated_at: now,
  }));

  const { error: writeError } = await db
    .from("organization_modules")
    .upsert(rows, { onConflict: "organization_id,module_name" });
  if (writeError) throw new Error(writeError.message);

  return FEATURE_CATALOG.map((f) => f.id).filter((id) => enabled.has(id));
}
