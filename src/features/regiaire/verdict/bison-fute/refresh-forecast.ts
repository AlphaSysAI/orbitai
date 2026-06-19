import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  DEFAULT_BISON_FUTE_CSV_URL,
  type BisonFuteForecastRow,
} from "@/features/regiaire/verdict/bison-fute/schemas";
import { parseBisonFuteCsv } from "@/features/regiaire/verdict/bison-fute/parse-csv";
import { fetchWithTimeout } from "@/features/regiaire/verdict/lib/fetch-with-timeout";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

const FETCH_TIMEOUT_MS = 15_000;
const UPSERT_BATCH = 200;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

function resolveCsvUrl(): string {
  return process.env.BISON_FUTE_CSV_URL?.trim() || DEFAULT_BISON_FUTE_CSV_URL;
}

export type RefreshBisonFuteResult = {
  csvUrl: string;
  rowsParsed: number;
  rowsUpserted: number;
  dates: number;
};

export async function refreshBisonFuteForecast(): Promise<RefreshBisonFuteResult> {
  const csvUrl = resolveCsvUrl();
  const response = await fetchWithTimeout(csvUrl, { timeoutMs: FETCH_TIMEOUT_MS });

  if (!response.ok) {
    throw new Error(
      `Échec téléchargement CSV Bison Futé (${response.status})`
    );
  }

  const csvText = await response.text();
  const parsed = parseBisonFuteCsv(csvText);

  if (parsed.length === 0) {
    throw new Error("CSV Bison Futé vide ou illisible");
  }

  const admin = getServiceClient();
  const db = forWrite(admin);

  let rowsUpserted = 0;
  for (let i = 0; i < parsed.length; i += UPSERT_BATCH) {
    const batch = parsed.slice(i, i + UPSERT_BATCH);
    const { error } = await db.from("bison_fute_forecast").upsert(
      batch.map((row) => toDbRow(row)),
      { onConflict: "forecast_date,zone,direction" }
    );

    if (error) {
      throw new Error(`Upsert bison_fute_forecast : ${error.message}`);
    }
    rowsUpserted += batch.length;
  }

  const uniqueDates = new Set(parsed.map((row) => row.date));

  return {
    csvUrl,
    rowsParsed: parsed.length,
    rowsUpserted,
    dates: uniqueDates.size,
  };
}

function toDbRow(row: BisonFuteForecastRow) {
  return {
    forecast_date: row.date,
    zone: row.zone,
    direction: row.direction,
    level: row.level,
  };
}
