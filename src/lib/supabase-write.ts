// Copyright © 2026 OrbitSys. Tous droits réservés.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Contournement typage Supabase pour écritures (schéma Database partiel manuel).
 * Évite Insert/Update inférés en `never` sans changer le runtime.
 */
export function forWrite(client: SupabaseClient<Database>): SupabaseClient {
  return client as SupabaseClient;
}
