// Copyright © 2026 OrbitSys. Tous droits réservés.

import { IsoDateSchema } from "@/features/regiaire/verdict/schemas";

const PARIS_TZ = "Europe/Paris";

export function todayParisIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PARIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function daysBetweenIso(from: string, to: string): number {
  IsoDateSchema.parse(from);
  IsoDateSchema.parse(to);
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}
