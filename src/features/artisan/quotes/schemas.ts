// Copyright © 2026 OrbitSys. Tous droits réservés.

import { z } from "zod";

/**
 * Brouillon de devis extrait par l'IA à partir de la demande client (texte).
 * Montants exprimés en euros (l'UI convertit en centimes pour la persistance).
 */
export const QuoteDraftSchema = z.object({
  customer_name: z
    .string()
    .nullable()
    .describe("Nom du client si mentionné dans la demande, sinon null."),
  labor_items: z
    .array(
      z.object({
        label: z.string().describe("Intitulé de la prestation / main-d'œuvre."),
        hours: z.number().describe("Heures estimées."),
        hourly_rate_eur: z.number().describe("Taux horaire suggéré en euros."),
      })
    )
    .describe("Lignes de main-d'œuvre estimées."),
  materials: z
    .array(
      z.object({
        label: z.string().describe("Matériau / fourniture."),
        quantity: z.number().describe("Quantité."),
        unit_price_eur: z.number().describe("Prix unitaire estimé en euros."),
      })
    )
    .describe("Matériaux mentionnés dans la demande. Vide si aucun."),
  catalog_service_titles: z
    .array(z.string())
    .describe(
      "Titres de prestations issus UNIQUEMENT du catalogue fourni (orthographe proche acceptée)."
    ),
  notes: z
    .string()
    .max(500)
    .describe("Synthèse courte pour le devis (max 500 caractères)."),
});

export type QuoteDraft = z.infer<typeof QuoteDraftSchema>;
