// Copyright © 2026 OrbitSys. Tous droits réservés.

"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import { canManageShiftOnAire } from "@/lib/regiaire/aire-scope";
import { requireRegiaireContext } from "@/lib/regiaire/require-context";
import {
  ShiftVerdictSchema,
  type ShiftClosure,
  type ShiftVerdict,
} from "@/features/regiaire/shift/schemas";
import { SHIFT_PERIOD_LABELS } from "@/features/regiaire/shift/schemas";

export type GenerateShiftVerdictResult =
  | { success: true; data: ShiftVerdict }
  | { success: false; error: string };

function formatClosuresForPrompt(closures: ShiftClosure[]): string {
  if (closures.length === 0) return "Aucune clôture disponible sur la période.";

  const byDate = new Map<string, ShiftClosure[]>();
  for (const c of closures) {
    const list = byDate.get(c.service_date) ?? [];
    list.push(c);
    byDate.set(c.service_date, list);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayClosures]) => {
      const lines = dayClosures.map((c) => {
        const missing =
          c.missing_labels.length > 0
            ? `Manquantes: ${c.missing_labels.join(", ")}`
            : "Toutes les tâches complétées";
        return `  ${SHIFT_PERIOD_LABELS[c.shift]}: ${c.completion_pct}% (${c.checked_tasks}/${c.total_tasks}) — ${missing}`;
      });
      return `${date}:\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

export async function generateShiftManagerVerdict(
  aireId: string,
  closures: ShiftClosure[]
): Promise<GenerateShiftVerdictResult> {
  try {
    const ctx = await requireRegiaireContext(aireId);
    const canManage = await canManageShiftOnAire(ctx);
    if (!canManage) {
      return {
        success: false,
        error: "Accès réservé au gérant ou à l'administration",
      };
    }

    const prompt = `Tu es le directeur des opérations d'une station-service autoroutière.
Analyse les 7 derniers jours de clôtures de quart ci-dessous et produis un verdict de management.

DONNÉES :
${formatClosuresForPrompt(closures)}

DIRECTIVES :
- tendance : "amelioration" si le taux moyen progresse, "degradation" s'il baisse, "stable" sinon.
- synthese : bilan exécutif (max 700 car.) — taux global, patterns par quart, évolution semaine.
- points_critiques : jusqu'à 5 tâches ou quarts problématiques, avec contexte chiffré.
- recommandations : 3 à 4 actions managériales concrètes (formation, process, planning).
- alerte : si un point est urgent (tâche critique jamais réalisée, quart systématiquement incomplet), sinon null.
- Réponds en français, ton directif et factuel.`;

    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: ShiftVerdictSchema,
      prompt,
      temperature: 0.5,
    });

    return { success: true, data: object };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return { success: false, error: message };
  }
}
