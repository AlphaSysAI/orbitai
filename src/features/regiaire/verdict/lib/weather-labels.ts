// Copyright © 2026 OrbitSys. Tous droits réservés.

export const WEATHER_CODE_LABELS: Record<number, string> = {
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

export function weatherDayLabel(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? "conditions variables";
}
