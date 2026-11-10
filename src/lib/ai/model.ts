// Copyright © 2026 OrbitSys. Tous droits réservés.

import { openai } from "@ai-sdk/openai";

/**
 * Point d'entrée unique pour le modèle IA.
 *
 * Centralise le choix du fournisseur/modèle pour éviter le couplage fort
 * (auparavant `openai("gpt-4o")` était codé en dur dans ~13 fichiers). Pour
 * basculer de modèle (ou de fournisseur), il suffit de changer ici ou de
 * définir la variable d'environnement `OPENAI_MODEL`.
 */
export const DEFAULT_AI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

/** Retourne le modèle IA à utiliser (par défaut `gpt-4o`, surchargable par env). */
export function getModel(modelId: string = DEFAULT_AI_MODEL) {
  return openai(modelId);
}

/**
 * Délai maximal (ms) au-delà duquel un appel de génération IA est avorté.
 * Empêche les requêtes qui « pendent » de bloquer une invocation serverless.
 */
export const AI_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Signal d'annulation à passer à `generateObject` / `generateText` / `streamText`
 * (`abortSignal`). Sans cela, un appel OpenAI bloqué immobilise la fonction
 * jusqu'au timeout de la plateforme.
 *
 * `AbortSignal.timeout` est disponible en runtime Node (18+) et Edge.
 */
export function aiTimeoutSignal(ms: number = AI_REQUEST_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}
