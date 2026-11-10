// Copyright © 2026 OrbitSys. Tous droits réservés.

import "server-only";

import { Worker } from "node:worker_threads";

/**
 * Extraction du texte d'un PDF, **déportée hors de l'event-loop principal**.
 *
 * `pdf-parse-fork` est CPU-bound et synchrone sous le capot : l'exécuter dans le
 * thread principal d'une Server Action bloque toutes les autres requêtes de
 * l'instance sous charge concurrente (uploads simultanés de BL). On le fait donc
 * tourner dans un `worker_thread`.
 *
 * Le code du worker est fourni en `eval:true` (chaîne) plutôt que dans un fichier
 * séparé : cela évite tout problème de bundling Next.js tout en gardant le
 * `require('pdf-parse-fork')` résolu depuis `node_modules` au runtime Node.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParseInline = require("pdf-parse-fork") as (
  buffer: Buffer
) => Promise<{ text?: string }>;

const WORKER_SOURCE = `
  const { parentPort, workerData } = require('worker_threads');
  try {
    const pdfParse = require('pdf-parse-fork');
    pdfParse(workerData.buffer)
      .then((r) => parentPort.postMessage({ ok: true, text: (r && r.text) || '' }))
      .catch((e) => parentPort.postMessage({ ok: false, error: String((e && e.message) || e) }));
  } catch (e) {
    parentPort.postMessage({ ok: false, error: String((e && e.message) || e) });
  }
`;

function extractInWorker(buffer: Buffer): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: { buffer },
      });
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const cleanup = () => void worker.terminate();

    worker.once(
      "message",
      (msg: { ok: boolean; text?: string; error?: string }) => {
        cleanup();
        if (msg.ok) resolve(msg.text ?? "");
        else reject(new Error(msg.error ?? "Échec extraction PDF (worker)"));
      }
    );
    worker.once("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Extrait le texte d'un buffer PDF. Utilise un worker thread ; en cas
 * d'indisponibilité des workers (environnement restreint), bascule sur un
 * parsing inline pour ne pas casser la fonctionnalité.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    return await extractInWorker(buffer);
  } catch (err) {
    console.warn(
      "[pdf-extract] worker indisponible, repli parsing inline:",
      err instanceof Error ? err.message : err
    );
    const parsed = await pdfParseInline(buffer);
    return parsed.text ?? "";
  }
}
