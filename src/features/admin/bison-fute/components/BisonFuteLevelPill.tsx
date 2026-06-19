import type { BisonFuteLevel } from "@/features/regiaire/verdict/bison-fute/schemas";
import { bisonFuteBadgeClass } from "@/features/regiaire/verdict/lib/bison-fute-display";

export function BisonFuteLevelPill({
  zone,
  level,
  compact = false,
}: {
  zone: number;
  level: BisonFuteLevel;
  compact?: boolean;
}) {
  return (
    <span
      title={`Zone ${zone} — ${level}`}
      className={`inline-flex items-center justify-center rounded font-bold uppercase ${bisonFuteBadgeClass(level)} ${
        compact
          ? "h-5 min-w-[1.25rem] px-1 text-[8px]"
          : "h-6 min-w-[1.5rem] px-1.5 text-[9px]"
      }`}
    >
      {zone}
    </span>
  );
}

export const BISON_FUTE_ENCODING_HELP = [
  "O = orange pour toutes les zones",
  "R / N = rouge / noir national",
  "O1R = orange + zone 1 rouge",
  "1O4O = zones 1 et 4 orange uniquement",
  "O4N = orange + zone 4 noire",
].join(" · ");
