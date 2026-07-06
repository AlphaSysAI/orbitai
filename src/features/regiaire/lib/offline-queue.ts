// Copyright © 2026 OrbitSys. Tous droits réservés.

/**
 * File d'attente hors-ligne minimale (localStorage) pour les aires en zone
 * blanche : les actions terrain effectuées sans réseau sont mises en attente
 * puis rejouées automatiquement au retour de la connexion.
 *
 * Périmètre volontairement minimal : actions de quart (pointage de tâche,
 * clôture). Les lectures et les uploads de fichiers ne sont pas couverts.
 */

const STORAGE_KEY = "orbitaire.offline-queue.v1";

export type OfflineActionType = "toggle_task" | "close_shift";

export type OfflineAction = {
  id: string;
  type: OfflineActionType;
  aireId: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

/**
 * Une invocation de server action sans réseau échoue en TypeError côté fetch
 * (« Failed to fetch » / « NetworkError… ») — c'est le signal de mise en file.
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!(err instanceof Error)) return false;
  return (
    err instanceof TypeError ||
    /fetch|network|connection/i.test(err.message)
  );
}

export function readOfflineQueue(): OfflineAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OfflineAction[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: OfflineAction[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Stockage plein ou indisponible : on abandonne silencieusement,
    // l'action échouera de façon visible côté UI.
  }
}

/**
 * Ajoute une action en file. `dedupeKey` remplace toute action équivalente
 * déjà en attente (ex. re-pointage de la même tâche : seul le dernier état
 * compte).
 */
export function enqueueOfflineAction(
  action: Omit<OfflineAction, "id" | "createdAt">,
  dedupeKey?: (a: OfflineAction) => boolean
): number {
  const queue = readOfflineQueue().filter((a) => !(dedupeKey?.(a) ?? false));
  queue.push({
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  });
  writeQueue(queue);
  return queue.length;
}

export type FlushHandlers = Record<
  OfflineActionType,
  (action: OfflineAction) => Promise<{ success: boolean }>
>;

export type FlushResult = {
  replayed: number;
  remaining: number;
};

/**
 * Rejoue la file dans l'ordre. S'arrête à la première erreur réseau (le
 * reste attendra la prochaine reconnexion). Une réponse serveur — succès ou
 * erreur métier — retire l'action de la file (pas de re-tentative infinie).
 */
export async function flushOfflineQueue(
  handlers: FlushHandlers
): Promise<FlushResult> {
  const queue = readOfflineQueue();
  if (queue.length === 0) return { replayed: 0, remaining: 0 };

  let replayed = 0;
  const remaining: OfflineAction[] = [];

  for (let i = 0; i < queue.length; i++) {
    const action = queue[i]!;
    const handler = handlers[action.type];
    if (!handler) continue; // type inconnu (version antérieure) : purgé

    try {
      await handler(action);
      replayed++;
    } catch (err) {
      if (isNetworkError(err)) {
        remaining.push(...queue.slice(i));
        break;
      }
      // Erreur non-réseau : le serveur a répondu, on ne rejoue pas.
    }
  }

  writeQueue(remaining);
  return { replayed, remaining: remaining.length };
}
