// Copyright © 2026 OrbitSys. Tous droits réservés.

import type { DeliveryStatus } from "@/features/regiaire/reception/schemas";

export const DELIVERY_STATUS_META: Record<
  DeliveryStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Brouillon",
    className: "bg-slate-700/60 text-slate-300 border-slate-600",
  },
  scanning: {
    label: "En scan",
    className: "bg-amber-600/20 text-amber-400 border-amber-500/40",
  },
  discrepancy: {
    label: "Écart",
    className: "bg-orange-600/20 text-orange-400 border-orange-500/40",
  },
  completed: {
    label: "Terminée",
    className: "bg-emerald-600/20 text-emerald-400 border-emerald-500/40",
  },
};

export type LineForCount = {
  expected_qty: number;
  scanned_qty: number;
};

export function countRemainingPackages(lines: LineForCount[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.max(0, line.expected_qty - line.scanned_qty),
    0
  );
}

export function isTerminalStatus(status: DeliveryStatus): boolean {
  return status === "completed" || status === "discrepancy";
}

export const BL_ACCEPT =
  "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp";

export const BL_MAX_BYTES = 10 * 1024 * 1024;
