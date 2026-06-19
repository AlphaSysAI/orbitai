import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  CloudLightning,
  CloudRain,
  CloudSun,
  Minus,
  Sun,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import type {
  AffluenceAttendue,
  RayonRecommendation,
  TopMouvement,
} from "@/features/regiaire/verdict/schemas";

export function isoDayOfWeek(isoDate: string): number {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const dow = d.getUTCDay();
  return dow === 0 ? 7 : dow;
}

export function formatVerdictDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const AFFLUENCE_CONFIG: Record<
  AffluenceAttendue,
  { label: string; className: string; dotClass: string }
> = {
  faible: {
    label: "Affluence faible",
    className: "border-slate-500/40 bg-slate-700/30 text-slate-200",
    dotClass: "bg-slate-400",
  },
  normale: {
    label: "Affluence normale",
    className: "border-amber-500/40 bg-amber-600/20 text-amber-100",
    dotClass: "bg-amber-400",
  },
  forte: {
    label: "Affluence forte",
    className: "border-emerald-500/40 bg-emerald-600/20 text-emerald-100",
    dotClass: "bg-emerald-400",
  },
};

export const DIRECTION_CONFIG: Record<
  RayonRecommendation["direction"],
  { label: string; icon: LucideIcon; className: string }
> = {
  augmenter: {
    label: "Augmenter",
    icon: TrendingUp,
    className: "border-emerald-500/30 bg-emerald-600/10 text-emerald-300",
  },
  maintenir: {
    label: "Maintenir",
    icon: Minus,
    className: "border-amber-500/30 bg-amber-600/10 text-amber-300",
  },
  reduire: {
    label: "Réduire",
    icon: TrendingDown,
    className: "border-red-500/30 bg-red-600/10 text-red-300",
  },
};

export const EMPHASE_LABELS: Record<RayonRecommendation["emphase"], string> = {
  forte: "Forte emphase",
  moderee: "Emphase modérée",
  legere: "Emphase légère",
};

export const MOUVEMENT_CONFIG: Record<
  TopMouvement["direction"],
  { className: string }
> = {
  hausse: { className: "text-emerald-400" },
  baisse: { className: "text-red-400" },
  stable: { className: "text-slate-400" },
};

export function weatherIconForCode(code: number): LucideIcon {
  if (code === 0) return Sun;
  if (code === 1) return CloudSun;
  if (code === 2 || code === 3) return Cloud;
  if (code === 45 || code === 48) return Cloud;
  if (code >= 51 && code <= 80) return CloudRain;
  if (code === 95) return CloudLightning;
  return Cloud;
}

export function formatDeltaPct(delta: number | null): string {
  if (delta === null) return "n/a";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}%`;
}
