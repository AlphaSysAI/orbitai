// Copyright © 2026 OrbitSys. Tous droits réservés.

import path from "node:path";

const DEFAULT_LOGS_DIR = "logs";

/**
 * Répertoire racine des logs OpenClaw (configurable via OPENCLAW_LOGS_DIR).
 * Peut être un chemin absolu ou relatif à la racine du projet.
 */
export function getOpenClawLogsDir(): string {
  const base = process.env.OPENCLAW_LOGS_DIR ?? path.join(process.cwd(), DEFAULT_LOGS_DIR);
  return path.resolve(base);
}

/** Répertoire des fichiers à traiter par le worker (entrée) */
export function getDailyLogsDir(): string {
  return path.join(getOpenClawLogsDir(), "daily");
}

/** Répertoire d'archivage des fichiers traités (sortie) */
export function getProcessedLogsDir(): string {
  return path.join(getOpenClawLogsDir(), "processed");
}

// --- Échange Inbox/Outbox (data/exchange) ---

const DEFAULT_EXCHANGE_DIR = "data/exchange";

/**
 * Répertoire racine d'échange OpenClaw ↔ OrbitAI (configurable via OPENCLAW_EXCHANGE_DIR).
 * À la racine du projet : data/exchange.
 */
export function getExchangeDir(): string {
  const base = process.env.OPENCLAW_EXCHANGE_DIR ?? path.join(process.cwd(), DEFAULT_EXCHANGE_DIR);
  return path.resolve(base);
}

/** Inbox : rapports journaliers (fichiers JSON à traiter) */
export function getInboxReportsDir(): string {
  return path.join(getExchangeDir(), "inbox", "reports");
}

/** Inbox : demandes de validation (fichiers JSON à traiter) */
export function getInboxValidationDir(): string {
  return path.join(getExchangeDir(), "inbox", "validation");
}

/** Inbox : manifests de skills (fichiers JSON à synchroniser vers data/skills/) */
export function getInboxSkillsDir(): string {
  return path.join(getExchangeDir(), "inbox", "skills");
}

/** Cache local des skills actifs (data/skills/) */
export function getSkillsCacheDir(): string {
  const base = process.env.OPENCLAW_SKILLS_DIR ?? path.join(process.cwd(), "data", "skills");
  return path.resolve(base);
}

/** Outbox : fichiers en sortie vers OpenClaw */
export function getOutboxDir(): string {
  return path.join(getExchangeDir(), "outbox");
}

/** Archive : fichiers traités (déplacés après traitement réussi) */
export function getExchangeArchiveDir(): string {
  return path.join(getExchangeDir(), "archive");
}
