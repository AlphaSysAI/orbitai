// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { createClient } from "@supabase/supabase-js";

import {
  BulkImportBisonFuteSchema,
  BisonFuteDayKeySchema,
  ListBisonFuteYearSchema,
  UpsertBisonFuteDaySchema,
  daySummaryToEditorDefaults,
  rowsToDaySummary,
  upsertDayInputToRows,
  type BisonFuteDaySummary,
} from "@/features/admin/bison-fute/schemas";
import { requireAdminUser } from "@/lib/admin/is-admin";
import { parseBisonFuteBulkLines } from "@/features/regiaire/verdict/bison-fute/parse-csv";
import {
  deleteBisonFuteForecastDate,
  upsertBisonFuteForecastRows,
} from "@/features/regiaire/verdict/bison-fute/persist-forecast";
import {
  BisonFuteForecastRowSchema,
  type BisonFuteForecastRow,
} from "@/features/regiaire/verdict/bison-fute/schemas";
import { forWrite } from "@/lib/supabase-write";
import type { Database } from "@/types/database.types";

export type AdminBisonFuteActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Configuration Supabase service_role manquante.");
  }
  return createClient<Database>(url, serviceKey);
}

async function requirePlatformAdmin() {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return {
      ok: false as const,
      error:
        admin.reason === "unauthenticated"
          ? "Authentification requise"
          : "Accès réservé aux administrateurs plateforme",
      code: admin.reason,
    };
  }
  return { ok: true as const };
}

function groupRowsByDate(rows: BisonFuteForecastRow[]): BisonFuteDaySummary[] {
  const dates = [...new Set(rows.map((r) => r.date))].sort();
  return dates.map((date) => rowsToDaySummary(date, rows));
}

export async function listBisonFuteDays(
  year: number
): Promise<AdminBisonFuteActionResult<BisonFuteDaySummary[]>> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) {
    return { success: false, error: gate.error, code: gate.code };
  }

  try {
    const parsedYear = ListBisonFuteYearSchema.parse({ year });
    const from = `${parsedYear.year}-01-01`;
    const to = `${parsedYear.year + 1}-01-01`;

    const admin = getServiceClient();
    const db = forWrite(admin);

    const { data, error } = await db
      .from("bison_fute_forecast")
      .select("forecast_date, zone, direction, level")
      .gte("forecast_date", from)
      .lt("forecast_date", to)
      .order("forecast_date", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const rows = (data ?? []).map((row) =>
      BisonFuteForecastRowSchema.parse({
        date: String(row.forecast_date),
        zone: row.zone,
        direction: row.direction,
        level: row.level,
      })
    );

    return { success: true, data: groupRowsByDate(rows) };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors du chargement";
    return { success: false, error: message };
  }
}

export async function getBisonFuteDay(
  date: string
): Promise<
  AdminBisonFuteActionResult<{
    summary: BisonFuteDaySummary;
    editor: ReturnType<typeof daySummaryToEditorDefaults>;
  }>
> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) {
    return { success: false, error: gate.error, code: gate.code };
  }

  try {
    const { date: isoDate } = BisonFuteDayKeySchema.parse({ date });
    const admin = getServiceClient();
    const db = forWrite(admin);

    const { data, error } = await db
      .from("bison_fute_forecast")
      .select("forecast_date, zone, direction, level")
      .eq("forecast_date", isoDate);

    if (error) {
      return { success: false, error: error.message };
    }

    const rows = (data ?? []).map((row) =>
      BisonFuteForecastRowSchema.parse({
        date: String(row.forecast_date),
        zone: row.zone,
        direction: row.direction,
        level: row.level,
      })
    );

    if (rows.length === 0) {
      return { success: false, error: "Jour introuvable" };
    }

    const summary = rowsToDaySummary(isoDate, rows);
    return {
      success: true,
      data: { summary, editor: daySummaryToEditorDefaults(summary) },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors du chargement";
    return { success: false, error: message };
  }
}

export async function upsertBisonFuteDay(
  input: unknown
): Promise<AdminBisonFuteActionResult<{ date: string; rowsUpserted: number }>> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) {
    return { success: false, error: gate.error, code: gate.code };
  }

  try {
    const parsed = UpsertBisonFuteDaySchema.parse(input);
    const rows = upsertDayInputToRows(parsed);
    const rowsUpserted = await upsertBisonFuteForecastRows(rows);
    return {
      success: true,
      data: { date: parsed.date, rowsUpserted },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de l'enregistrement";
    return { success: false, error: message };
  }
}

export async function deleteBisonFuteDay(
  date: string
): Promise<AdminBisonFuteActionResult> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) {
    return { success: false, error: gate.error, code: gate.code };
  }

  try {
    const { date: isoDate } = BisonFuteDayKeySchema.parse({ date });
    await deleteBisonFuteForecastDate(isoDate);
    return { success: true, data: undefined };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de la suppression";
    return { success: false, error: message };
  }
}

export async function bulkImportBisonFute(
  text: string
): Promise<
  AdminBisonFuteActionResult<{
    rowsParsed: number;
    rowsUpserted: number;
    dates: number;
  }>
> {
  const gate = await requirePlatformAdmin();
  if (!gate.ok) {
    return { success: false, error: gate.error, code: gate.code };
  }

  try {
    const { text: bulkText } = BulkImportBisonFuteSchema.parse({ text });
    const parsed = parseBisonFuteBulkLines(bulkText);

    if (parsed.length === 0) {
      return {
        success: false,
        error: "Aucune ligne valide (format date,aller,retour attendu)",
      };
    }

    const rowsUpserted = await upsertBisonFuteForecastRows(parsed);
    const uniqueDates = new Set(parsed.map((row) => row.date));

    return {
      success: true,
      data: {
        rowsParsed: parsed.length,
        rowsUpserted,
        dates: uniqueDates.size,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors de l'import";
    return { success: false, error: message };
  }
}
