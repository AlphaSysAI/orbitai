import {
  BisonFuteDirectionSchema,
  BisonFuteForecastRowSchema,
  BisonFuteLevelSchema,
  type BisonFuteDirection,
  type BisonFuteForecastRow,
  type BisonFuteLevel,
  type BisonFuteZone,
} from "@/features/regiaire/verdict/bison-fute/schemas";

const LEVEL_CHARS: Record<string, BisonFuteLevel> = {
  O: "orange",
  R: "rouge",
  N: "noir",
};

function charToLevel(char: string): BisonFuteLevel | null {
  return LEVEL_CHARS[char] ?? null;
}

/**
 * Décode une colonne aller/retour du CSV Bison Futé (data.gouv.fr / OpenEventDatabase).
 *
 * Règles (cf. bisonfute_previ.py) :
 * - Première lettre O/R/N sans chiffre devant → niveau par défaut pour toutes les zones.
 * - Sinon, pour chaque zone 1–6 : si le chiffre de zone apparaît, le caractère suivant fixe le niveau.
 * - Zones non citées → vert.
 *
 * Exemples : O | O1R | 1O4O | O4N | 3R4R | R | N
 */
export function decodeBisonFuteEncoding(
  encoding: string
): Map<BisonFuteZone, BisonFuteLevel> {
  const levels = new Map<BisonFuteZone, BisonFuteLevel>();
  for (let z = 1; z <= 6; z++) {
    levels.set(z as BisonFuteZone, "vert");
  }

  const trimmed = encoding.trim();
  if (!trimmed) return levels;

  const defaultChar = trimmed[0]! > "A" ? trimmed[0]! : "";

  for (let zone = 1; zone <= 6; zone++) {
    const zoneStr = String(zone);
    const idx = trimmed.indexOf(zoneStr);
    const colorChar = idx >= 0 ? (trimmed[idx + 1] ?? "") : defaultChar;
    const level = charToLevel(colorChar);
    if (level) {
      levels.set(zone as BisonFuteZone, level);
    }
  }

  return levels;
}

/** Parse une date CSV DD/MM/YY → ISO YYYY-MM-DD. */
export function parseBisonFuteCsvDate(raw: string): string | null {
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const [, dd, mm, yy] = match;
  const year = 2000 + Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expandDirection(
  date: string,
  direction: BisonFuteDirection,
  encoding: string
): BisonFuteForecastRow[] {
  const levels = decodeBisonFuteEncoding(encoding);
  const rows: BisonFuteForecastRow[] = [];

  for (let zone = 1; zone <= 6; zone++) {
    rows.push(
      BisonFuteForecastRowSchema.parse({
        date,
        zone,
        direction,
        level: levels.get(zone as BisonFuteZone) ?? "vert",
      })
    );
  }

  return rows;
}

/**
 * Parse le CSV complet (header : date,aller,retour).
 * Une ligne = une date ; chaque direction absente ou vide → toutes zones vertes.
 */
export function parseBisonFuteCsv(csvText: string): BisonFuteForecastRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = lines[0]!.toLowerCase().split(",").map((c) => c.trim());
  const dateIdx = header.indexOf("date");
  const allerIdx = header.indexOf("aller");
  const retourIdx = header.indexOf("retour");
  if (dateIdx < 0 || allerIdx < 0 || retourIdx < 0) {
    throw new Error(
      "CSV Bison Futé invalide : colonnes date, aller, retour attendues"
    );
  }

  const rows: BisonFuteForecastRow[] = [];

  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const isoDate = parseBisonFuteCsvDate(cols[dateIdx] ?? "");
    if (!isoDate) continue;

    const allerEncoding = cols[allerIdx] ?? "";
    const retourEncoding = cols[retourIdx] ?? "";

    rows.push(
      ...expandDirection(
        isoDate,
        BisonFuteDirectionSchema.parse("aller"),
        allerEncoding
      ),
      ...expandDirection(
        isoDate,
        BisonFuteDirectionSchema.parse("retour"),
        retourEncoding
      )
    );
  }

  return rows;
}

export function worstBisonFuteLevel(
  ...levels: (BisonFuteLevel | null | undefined)[]
): BisonFuteLevel {
  let worst: BisonFuteLevel = "vert";
  const priority = { vert: 0, orange: 1, rouge: 2, noir: 3 } as const;

  for (const level of levels) {
    if (!level) continue;
    if (priority[level] > priority[worst]) {
      worst = BisonFuteLevelSchema.parse(level);
    }
  }

  return worst;
}
