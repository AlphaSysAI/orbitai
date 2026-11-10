// Copyright © 2026 OrbitSys. Tous droits réservés.

/** Valeur unitaire de référence (€ TTC) par catégorie — estimation dashboard. */
const CATEGORY_UNIT_VALUE_EUR: Record<string, number> = {
  Boulangerie: 1.8,
  Boissons: 1.2,
  "Épicerie sucrée": 2.5,
  Divers: 1.5,
};

const DEFAULT_UNIT_VALUE_EUR = 1.5;

/** Part de la valeur récupérable grâce à l'alerte péremption (J+1 à J+3). */
export const EXPIRY_RECOVERY_RATE = 0.65;

/** Réduction de casse estimée sur stock DLC suivi. */
export const STOCK_SHRINKAGE_RATE = 0.06;

export const TRADITIONAL_RECEPTION_MINUTES = 60;
export const REGIAIRE_RECEPTION_MINUTES = 10;
export const RECEPTION_MINUTES_SAVED =
  TRADITIONAL_RECEPTION_MINUTES - REGIAIRE_RECEPTION_MINUTES;

export function unitValueForCategory(category: string | null | undefined): number {
  if (!category) return DEFAULT_UNIT_VALUE_EUR;
  return CATEGORY_UNIT_VALUE_EUR[category] ?? DEFAULT_UNIT_VALUE_EUR;
}

export function formatEur(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatHours(hours: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(hours);
}
