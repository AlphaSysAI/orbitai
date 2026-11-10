// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { getPreviousServiceContext } from "@/features/regiaire/shift/service-context-core";
import { getShiftClosure } from "@/features/regiaire/shift/shift-access";
import {
  formatServiceDateFr,
  SHIFT_PERIOD_LABELS,
  type ShiftPeriod,
} from "@/features/regiaire/shift/schemas";
import {
  RegiaireContextError,
  requireRegiaireContext,
} from "@/lib/regiaire/require-context";

export type PreviousShiftHandover = {
  shift: ShiftPeriod;
  service_date: string;
  shiftLabel: string;
  serviceDateLabel: string;
  note: string | null;
  hasClosure: boolean;
};

export type GetPreviousShiftHandoverResult =
  | { success: true; data: PreviousShiftHandover }
  | { success: false; error: string; code?: string };

/** Note de passation du quart précédent — accessible aux membres. */
export async function getPreviousShiftHandover(
  aireId: string
): Promise<GetPreviousShiftHandoverResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const prev = getPreviousServiceContext();
    const closure = await getShiftClosure(ctx, prev.shift, prev.service_date);

    return {
      success: true,
      data: {
        shift: prev.shift,
        service_date: prev.service_date,
        shiftLabel: SHIFT_PERIOD_LABELS[prev.shift],
        serviceDateLabel: formatServiceDateFr(prev.service_date),
        note: closure?.note ?? null,
        hasClosure: closure != null,
      },
    };
  } catch (error) {
    if (error instanceof RegiaireContextError) {
      return { success: false, error: error.message, code: error.code };
    }
    return { success: false, error: "Erreur lors du chargement" };
  }
}
