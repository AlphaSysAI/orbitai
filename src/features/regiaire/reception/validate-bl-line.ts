import type { BLExtractedUncertainLine, NormalizedBlLine } from "@/features/regiaire/reception/schemas";
import { UNREADABLE_LINE_NAME as PLACEHOLDER } from "@/features/regiaire/reception/schemas";

export { PLACEHOLDER as UNREADABLE_LINE_NAME };

/** Valide le checksum EAN-13 (GTIN-13). */
export function isValidEan13(ean: string): boolean {
  const digits = ean.replace(/\D/g, "");
  if (digits.length !== 13) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = parseInt(digits[i]!, 10);
    if (Number.isNaN(n)) return false;
    sum += i % 2 === 0 ? n : n * 3;
  }

  const check = (10 - (sum % 10)) % 10;
  const last = parseInt(digits[12]!, 10);
  return !Number.isNaN(last) && check === last;
}

/** Date DLC plausible (format ISO, entre 2000 et +10 ans). */
export function isPlausibleDlc(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;

  const min = new Date("2000-01-01T00:00:00");
  const max = new Date();
  max.setFullYear(max.getFullYear() + 10);

  return d >= min && d <= max;
}

function sanitizeEanDigits(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

/**
 * Normalise une ligne extraite avec incertitude + garde-fous déterministes.
 * EAN illisible → null (non bloquant). Nom/qté illisibles → needs_review.
 */
export function normalizeExtractedLine(
  line: BLExtractedUncertainLine
): NormalizedBlLine {
  let needsReview = false;

  let raw_name: string;
  if (line.name.confident && line.name.value?.trim()) {
    raw_name = line.name.value.trim();
  } else if (line.name.value?.trim()) {
    raw_name = line.name.value.trim();
    needsReview = true;
  } else {
    raw_name = PLACEHOLDER;
    needsReview = true;
  }

  let ean: string | null = null;
  if (line.ean.confident && line.ean.value) {
    ean = sanitizeEanDigits(line.ean.value);
  } else if (line.ean.value && line.ean.confident === false) {
    ean = null;
  } else if (line.ean.value) {
    ean = sanitizeEanDigits(line.ean.value);
  }

  let expected_qty: number;
  if (
    line.expected_qty.confident &&
    line.expected_qty.value !== null &&
    line.expected_qty.value > 0
  ) {
    expected_qty = line.expected_qty.value;
  } else if (
    line.expected_qty.value !== null &&
    line.expected_qty.value > 0 &&
    !line.expected_qty.confident
  ) {
    expected_qty = line.expected_qty.value;
    needsReview = true;
  } else {
    expected_qty =
      line.expected_qty.value !== null && line.expected_qty.value > 0
        ? line.expected_qty.value
        : 0;
    needsReview = true;
  }

  let dlc: string | null = null;
  if (line.dlc.value && isPlausibleDlc(line.dlc.value)) {
    dlc = line.dlc.value;
  }

  if (ean !== null && !isValidEan13(ean)) {
    ean = null;
  }

  if (!Number.isInteger(expected_qty) || expected_qty <= 0) {
    needsReview = true;
  }

  return {
    raw_name,
    ean,
    expected_qty: expected_qty > 0 ? expected_qty : 0,
    dlc,
    needs_review: needsReview,
  };
}

/** Revalide une ligne persistée avant confirmation de revue (nom + qté uniquement). */
export function lineNeedsReview(raw_name: string, expected_qty: number): boolean {
  const name = raw_name.trim();
  if (!name || name === PLACEHOLDER) return true;
  if (!Number.isInteger(expected_qty) || expected_qty <= 0) return true;
  return false;
}

export function computeNeedsReviewFromEdits(
  raw_name: string,
  expected_qty: number
): boolean {
  return lineNeedsReview(raw_name, expected_qty);
}
