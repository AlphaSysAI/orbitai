import "server-only";

import {
  SchoolHolidaySignalSchema,
  SchoolHolidayStatusSchema,
  type SchoolHolidaySignal,
  type SchoolZone,
} from "@/features/regiaire/verdict/schemas";
import { fetchWithTimeout } from "@/features/regiaire/verdict/lib/fetch-with-timeout";
import { getStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

const EDUCATION_CALENDAR_API =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

const SIGNAL_TIMEOUT_MS = 3_000;

const ZONE_LABELS: Record<SchoolZone, string> = {
  A: "Zone A",
  B: "Zone B",
  C: "Zone C",
};

type HolidayRecord = {
  description?: string;
  start_date?: string;
  end_date?: string;
};

type HolidayApiResponse = {
  results?: HolidayRecord[];
};

function parseIsoDateOnly(value: string): string {
  return value.slice(0, 10);
}

/**
 * Vacances scolaires via data.education.gouv.fr.
 * Timeout ~3 s + fallback { available: false } — ne bloque jamais le Verdict.
 */
export async function getSchoolHolidayStatus(
  ctx: RegiaireContext,
  date: string
): Promise<SchoolHolidaySignal> {
  const target = parseIsoDateOnly(date);
  const settings = await getStationSettings(ctx);

  if (!settings) {
    return SchoolHolidaySignalSchema.parse({
      available: false,
      reason: "Paramètres station manquants (zone scolaire)",
    });
  }

  const zoneLabel = ZONE_LABELS[settings.schoolZone];
  const year = target.slice(0, 4);

  const params = new URLSearchParams({
    limit: "100",
    lang: "fr",
    timezone: "Europe/Paris",
    refine: `zones:"${zoneLabel}"`,
  });
  params.append("refine", `start_date:"${year}"`);
  params.append("refine", 'population:"Élèves"');

  try {
    const response = await fetchWithTimeout(
      `${EDUCATION_CALENDAR_API}?${params.toString()}`,
      { next: { revalidate: 86_400 }, timeoutMs: SIGNAL_TIMEOUT_MS }
    );

    if (!response.ok) {
      return SchoolHolidaySignalSchema.parse({
        available: false,
        reason: `API calendrier scolaire (${response.status})`,
      });
    }

    const raw = (await response.json()) as HolidayApiResponse;

    for (const row of raw.results ?? []) {
      const start = row.start_date ? parseIsoDateOnly(row.start_date) : null;
      const end = row.end_date ? parseIsoDateOnly(row.end_date) : null;
      if (!start || !end) continue;

      if (target >= start && target <= end) {
        return SchoolHolidaySignalSchema.parse({
          available: true,
          status: SchoolHolidayStatusSchema.parse({
            date: target,
            schoolZone: settings.schoolZone,
            isOnHoliday: true,
            label: row.description?.trim() || "Vacances scolaires",
          }),
        });
      }
    }

    return SchoolHolidaySignalSchema.parse({
      available: true,
      status: SchoolHolidayStatusSchema.parse({
        date: target,
        schoolZone: settings.schoolZone,
        isOnHoliday: false,
        label: null,
      }),
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "API vacances timeout (>3s)"
        : error instanceof Error
          ? error.message
          : "Erreur vacances scolaires";
    return SchoolHolidaySignalSchema.parse({ available: false, reason });
  }
}
