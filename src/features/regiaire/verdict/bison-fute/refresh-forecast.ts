import "server-only";

import { DEFAULT_BISON_FUTE_CSV_URL } from "@/features/regiaire/verdict/bison-fute/schemas";
import { parseBisonFuteCsv } from "@/features/regiaire/verdict/bison-fute/parse-csv";
import { upsertBisonFuteForecastRows } from "@/features/regiaire/verdict/bison-fute/persist-forecast";
import { fetchWithTimeout } from "@/features/regiaire/verdict/lib/fetch-with-timeout";

const FETCH_TIMEOUT_MS = 15_000;

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

  const rowsUpserted = await upsertBisonFuteForecastRows(parsed);

  const uniqueDates = new Set(parsed.map((row) => row.date));

  return {
    csvUrl,
    rowsParsed: parsed.length,
    rowsUpserted,
    dates: uniqueDates.size,
  };
}
