import "server-only";

import {
  SchoolHolidayStatusSchema,
  type SchoolHolidayStatus,
  type SchoolZone,
} from "@/features/regiaire/verdict/schemas";
import { requireStationSettings } from "@/features/regiaire/verdict/station-settings-access";
import type { RegiaireContext } from "@/lib/regiaire/require-context";

const EDUCATION_CALENDAR_API =
  "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records";

const ZONE_LABELS: Record<SchoolZone, string> = {
  A: "Zone A",
  B: "Zone B",
  C: "Zone C",
};

type HolidayRecord = {
  description?: string;
  start_date?: string;
  end_date?: string;
  zones?: string;
  population?: string;
};

type HolidayApiResponse = {
  results?: HolidayRecord[];
};

function schoolZoneToApiLabel(zone: SchoolZone): string {
  return ZONE_LABELS[zone];
}

function parseIsoDateOnly(value: string): string {
  return value.slice(0, 10);
}

/**
 * Vacances scolaires via data.education.gouv.fr (open data).
 * Filtre par zone A/B/C configurée sur la station.
 */
export async function getSchoolHolidayStatus(
  ctx: RegiaireContext,
  date: string
): Promise<SchoolHolidayStatus> {
  const settings = await requireStationSettings(ctx);
  const zoneLabel = schoolZoneToApiLabel(settings.schoolZone);
  const year = parseIsoDateOnly(date).slice(0, 4);

  const params = new URLSearchParams({
    limit: "100",
    lang: "fr",
    timezone: "Europe/Paris",
    refine: `zones:"${zoneLabel}"`,
  });

  params.append("refine", `start_date:"${year}"`);
  params.append("refine", 'population:"Élèves"');

  const response = await fetch(`${EDUCATION_CALENDAR_API}?${params.toString()}`, {
    next: { revalidate: 86_400 },
  });

  if (!response.ok) {
    throw new Error(`API calendrier scolaire indisponible (${response.status})`);
  }

  const raw = (await response.json()) as HolidayApiResponse;
  const target = parseIsoDateOnly(date);

  for (const row of raw.results ?? []) {
    const start = row.start_date ? parseIsoDateOnly(row.start_date) : null;
    const end = row.end_date ? parseIsoDateOnly(row.end_date) : null;
    if (!start || !end) continue;

    if (target >= start && target <= end) {
      return SchoolHolidayStatusSchema.parse({
        date: target,
        schoolZone: settings.schoolZone,
        isOnHoliday: true,
        label: row.description?.trim() || "Vacances scolaires",
      });
    }
  }

  return SchoolHolidayStatusSchema.parse({
    date: target,
    schoolZone: settings.schoolZone,
    isOnHoliday: false,
    label: null,
  });
}
