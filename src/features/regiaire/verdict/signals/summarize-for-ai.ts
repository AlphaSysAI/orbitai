import {
  TrendCategorySummarySchema,
  type TrendCategorySummary,
  type TrendWindows,
  type VerdictSignalsSnapshot,
  VerdictSignalsSnapshotSchema,
  type WeatherSignal,
  type SchoolHolidaySignal,
  type TrafficSignal,
  type BisonFuteSignal,
  type StationSettings,
} from "@/features/regiaire/verdict/schemas";
import {
  BISON_FUTE_LEVEL_LABELS,
  BISON_FUTE_ZONE_LABELS,
  type BisonFuteZone,
} from "@/features/regiaire/verdict/bison-fute/schemas";

export function summarizeTrendsByCategory(
  trends: TrendWindows
): TrendCategorySummary[] {
  const categories = new Set([
    ...Object.keys(trends.current.byCategory),
    ...Object.keys(trends.lastYear.byCategory),
  ]);

  const summaries: TrendCategorySummary[] = [];

  for (const category of categories) {
    const current15d = trends.current.byCategory[category] ?? 0;
    const lastYear15d = trends.lastYear.byCategory[category] ?? 0;
    const deltaPct =
      lastYear15d > 0
        ? Math.round(((current15d - lastYear15d) / lastYear15d) * 1000) / 10
        : null;

    summaries.push(
      TrendCategorySummarySchema.parse({
        category,
        current15d,
        lastYear15d,
        deltaPct,
      })
    );
  }

  return summaries.sort(
    (a, b) => Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0)
  );
}

export function buildSignalsSnapshot(params: {
  runDate: string;
  settings: StationSettings | null;
  weather: WeatherSignal;
  schoolHoliday: SchoolHolidaySignal;
  traffic: TrafficSignal;
  bisonFute: BisonFuteSignal;
  trendsSummary: TrendCategorySummary[];
}): VerdictSignalsSnapshot {
  return VerdictSignalsSnapshotSchema.parse({
    runDate: params.runDate,
    station: {
      city: params.settings?.city ?? null,
      schoolZone: params.settings?.schoolZone ?? "C",
      orderDays: params.settings?.orderDays ?? [1, 2, 3, 4, 5],
    },
    weather: params.weather,
    schoolHoliday: params.schoolHoliday,
    traffic: params.traffic,
    bisonFute: params.bisonFute,
    trendsSummary: params.trendsSummary,
  });
}

import { weatherDayLabel } from "@/features/regiaire/verdict/lib/weather-labels";
export function buildVerdictPromptContext(snapshot: VerdictSignalsSnapshot): string {
  const lines: string[] = [
    `Date de service : ${snapshot.runDate}`,
    `Station : ${snapshot.station.city ?? "non renseignée"} — zone scolaire ${snapshot.station.schoolZone}`,
    `Jours de commande : ${snapshot.station.orderDays.join(", ")}`,
  ];

  if (snapshot.weather.available && snapshot.weather.forecast) {
    const w = snapshot.weather.forecast;
    lines.push("Météo J0→J+3 :");
    for (const day of w.days) {
      lines.push(
        `  • ${day.date} : ${weatherDayLabel(day.weatherCode)}, ${day.tempMinC}–${day.tempMaxC}°C, pluie ${day.precipitationMm} mm`
      );
    }
  } else {
    lines.push(`Météo : indisponible (${snapshot.weather.reason ?? "?"})`);
  }

  if (snapshot.schoolHoliday.available && snapshot.schoolHoliday.status) {
    const h = snapshot.schoolHoliday.status;
    lines.push(
      h.isOnHoliday
        ? `Vacances scolaires : OUI — ${h.label ?? "période de vacances"}`
        : "Vacances scolaires : non"
    );
  } else {
    lines.push(
      `Vacances scolaires : indisponible (${snapshot.schoolHoliday.reason ?? "?"})`
    );
  }

  if (snapshot.bisonFute.available && snapshot.bisonFute.level != null) {
    const zone = snapshot.bisonFute.zone;
    const zoneLabel =
      zone != null
        ? BISON_FUTE_ZONE_LABELS[zone as BisonFuteZone]
        : "zone inconnue";
    const levelLabel = BISON_FUTE_LEVEL_LABELS[snapshot.bisonFute.level];
    lines.push(
      `>>> PRÉVISION BISON FUTÉ (signal prioritaire affluence) : zone ${zone} (${zoneLabel}) — journée ${levelLabel.toUpperCase()} (aller ${snapshot.bisonFute.levelAller ?? "?"}, retour ${snapshot.bisonFute.levelRetour ?? "?"})`
    );
    if (
      snapshot.bisonFute.level === "rouge" ||
      snapshot.bisonFute.level === "noir"
    ) {
      lines.push(
        "→ Affluence exceptionnelle attendue sur l'autoroute : privilégier affluence_attendue = forte."
      );
    } else if (snapshot.bisonFute.level === "orange") {
      lines.push(
        "→ Circulation chargée : affluence_attendue normale à forte selon les autres signaux."
      );
    }
  } else {
    lines.push(
      `Bison Futé : indisponible (${snapshot.bisonFute.reason ?? "?"})`
    );
  }

  if (snapshot.traffic.available && snapshot.traffic.footfallIndex != null) {
    lines.push(
      `Indice fréquentation historique (baseline) : ${snapshot.traffic.footfallIndex} (base 100)`
    );
  } else {
    lines.push(
      `Indice fréquentation historique : indisponible (${snapshot.traffic.reason ?? "?"})`
    );
  }

  lines.push("Tendances 15 jours vs N-1 aligné (par rayon) :");
  for (const row of snapshot.trendsSummary.slice(0, 12)) {
    const delta =
      row.deltaPct == null ? "n/a" : `${row.deltaPct > 0 ? "+" : ""}${row.deltaPct}%`;
    lines.push(
      `  • ${row.category} : actuel ${row.current15d} / N-1 ${row.lastYear15d} (${delta})`
    );
  }

  return lines.join("\n");
}
