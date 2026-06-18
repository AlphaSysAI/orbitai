import "server-only";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import {
  BLExtractionSchema,
  type BLExtraction,
} from "@/features/regiaire/reception/schemas";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse-fork") as (
  buffer: Buffer
) => Promise<{ text: string }>;

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const BL_EXTRACTION_PROMPT = `Tu es un assistant de réception en station-service / shop.
Extrais les lignes du bon de livraison (BL) fourni.
Pour chaque ligne produit, retourne :
- name : libellé produit
- ean : code EAN/GTIN (chiffres uniquement, sans espaces)
- expected_qty : quantité attendue (entier positif)
- dlc : date limite de consommation au format YYYY-MM-DD, ou null si absente / non applicable

Ignore les lignes sans quantité identifiable. Ne invente pas de produits absents du document.`;

function normalizeMimeType(mimeType: string, fileName: string): string {
  const lower = fileName.toLowerCase();
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return mimeType;
}

async function extractFromPdf(buffer: Buffer): Promise<BLExtraction> {
  const parsed = await pdfParse(buffer);
  const text = parsed.text?.trim();
  if (!text) {
    throw new Error("Impossible d'extraire le texte du PDF");
  }

  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: BLExtractionSchema,
    prompt: `${BL_EXTRACTION_PROMPT}\n\n--- CONTENU BL (texte extrait) ---\n${text.slice(0, 120_000)}`,
  });

  return BLExtractionSchema.parse(object);
}

async function extractFromImage(buffer: Buffer): Promise<BLExtraction> {
  const { object } = await generateObject({
    model: openai("gpt-4o"),
    schema: BLExtractionSchema,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: BL_EXTRACTION_PROMPT },
          {
            type: "image",
            image: buffer,
          },
        ],
      },
    ],
  });

  return BLExtractionSchema.parse(object);
}

export async function parseBlDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<BLExtraction> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquante");
  }

  const resolvedMime = normalizeMimeType(mimeType, fileName);

  if (resolvedMime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    return extractFromPdf(buffer);
  }

  if (IMAGE_MIME_TYPES.has(resolvedMime)) {
    return extractFromImage(buffer);
  }

  throw new Error(
    "Format non supporté. Utilisez un PDF ou une image (JPEG, PNG, WebP)."
  );
}
