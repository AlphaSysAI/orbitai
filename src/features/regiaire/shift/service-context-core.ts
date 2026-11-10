// Copyright © 2026 OrbitSys. Tous droits réservés.

import { ServiceContextSchema, type ServiceContext, type ShiftPeriod } from "@/features/regiaire/shift/schemas";

const PARIS_TZ = "Europe/Paris";

function parisDateParts(now: Date): { date: string; hour: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour"), 10);

  return { date, hour: Number.isNaN(hour) ? 0 : hour };
}

function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + delta));
  return dt.toISOString().slice(0, 10);
}

/**
 * Dérive le quart courant et la date de service (Europe/Paris).
 * Matin 6–14, Après-midi 14–22, Nuit 22–6.
 * Le quart NUIT appartient à la date de début (22h).
 */
export function serviceContext(now: Date = new Date()): ServiceContext {
  const { date, hour } = parisDateParts(now);

  let shift: ShiftPeriod;
  let service_date: string;

  if (hour >= 6 && hour < 14) {
    shift = "matin";
    service_date = date;
  } else if (hour >= 14 && hour < 22) {
    shift = "apres_midi";
    service_date = date;
  } else if (hour >= 22) {
    shift = "nuit";
    service_date = date;
  } else {
    shift = "nuit";
    service_date = addDays(date, -1);
  }

  return ServiceContextSchema.parse({ shift, service_date });
}

/** Quart précédent (pour note de passation visible aux membres). */
export function getPreviousServiceContext(
  now: Date = new Date()
): ServiceContext {
  const current = serviceContext(now);

  if (current.shift === "matin") {
    return ServiceContextSchema.parse({
      shift: "nuit",
      service_date: addDays(current.service_date, -1),
    });
  }

  if (current.shift === "apres_midi") {
    return ServiceContextSchema.parse({
      shift: "matin",
      service_date: current.service_date,
    });
  }

  return ServiceContextSchema.parse({
    shift: "apres_midi",
    service_date: current.service_date,
  });
}
