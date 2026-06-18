import {
  TrendCategorySummarySchema,
  type TrendCategorySummary,
  type TrendWindows,
  type VerdictSignalsSnapshot,
  VerdictSignalsSnapshotSchema,
  type WeatherSignal,
  type SchoolHolidaySignal,
  type TrafficSignal,
  type StationSettings,
} from "@/features/regiaire/verdict/schemas";

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
    trendsSummary: params.trendsSummary,
  });
}

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "ciel dégagé",
  1: "principalement dégagé",
  2: "partiellement nuageux",
  3: "couvert",
  45: "brouillard",
  48: "brouillard givrant",
  51: "bruine légère",
  61: "pluie modérée",
  63: "pluie",
  80: "averses",
  95: "orages",
};

function weatherDayLabel(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? `code ${code}`;
}

/** Résumé compact pour le prompt IA (pas de dump brut). */
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

  if (snapshot.traffic.available && snapshot.traffic.footfallIndex != null) {
    lines.push(
      `Indice trafic du jour : ${snapshot.traffic.footfallIndex} (base 100)`
    );
  } else {
    lines.push(`Trafic : indisponible (${snapshot.traffic.reason ?? "?"})`);
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
