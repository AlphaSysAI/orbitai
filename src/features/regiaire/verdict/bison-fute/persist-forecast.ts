// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { BisonFuteForecastRow } from "@/features/regiaire/verdict/bison-fute/schemas";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

const UPSERT_BATCH = 200;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

function toDbRow(row: BisonFuteForecastRow) {
  return {
    forecast_date: row.date,
    zone: row.zone,
    direction: row.direction,
    level: row.level,
  };
}

export async function upsertBisonFuteForecastRows(
  rows: BisonFuteForecastRow[]
): Promise<number> {
  if (rows.length === 0) return 0;

  const admin = getServiceClient();
  const db = forWrite(admin);

  let upserted = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await db.from("bison_fute_forecast").upsert(
      batch.map(toDbRow),
      { onConflict: "forecast_date,zone,direction" }
    );

    if (error) {
      throw new Error(`Upsert bison_fute_forecast : ${error.message}`);
    }
    upserted += batch.length;
  }

  return upserted;
}

export async function deleteBisonFuteForecastDate(date: string): Promise<void> {
  const admin = getServiceClient();
  const db = forWrite(admin);

  const { error } = await db
    .from("bison_fute_forecast")
    .delete()
    .eq("forecast_date", date);

  if (error) {
    throw new Error(`Suppression bison_fute_forecast : ${error.message}`);
  }
}
