import type { BisonFuteLevel } from "@/features/regiaire/verdict/bison-fute/schemas";

export function bisonFuteBadgeClass(level: BisonFuteLevel): string {
  switch (level) {
    case "vert":
      return "border-emerald-500/50 bg-emerald-600/20 text-emerald-300";
    case "orange":
      return "border-orange-500/50 bg-orange-600/20 text-orange-300";
    case "rouge":
      return "border-red-500/50 bg-red-600/20 text-red-300";
    case "noir":
      return "border-slate-500/60 bg-slate-950 text-white ring-1 ring-white/20";
  }
}

export function bisonFuteLevelDescription(level: BisonFuteLevel): string {
  switch (level) {
    case "vert":
      return "Circulation fluide";
    case "orange":
      return "Circulation chargée";
    case "rouge":
      return "Circulation très difficile";
    case "noir":
      return "Circulation extrêmement difficile";
  }
}
