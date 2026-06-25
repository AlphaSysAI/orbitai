// Copyright © 2026 OrbitSys. Tous droits réservés.

import { z } from "zod";

export const DeliveryStatusSchema = z.enum([
  "draft",
  "scanning",
  "discrepancy",
  "completed",
]);

export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

/** Champ extrait avec niveau de confiance (sortie IA). */
export const UncertainStringFieldSchema = z.object({
  value: z.string().nullable(),
  confident: z.boolean(),
});

export const UncertainQtyFieldSchema = z.object({
  value: z.number().int().nullable(),
  confident: z.boolean(),
});

export type UncertainStringField = z.infer<typeof UncertainStringFieldSchema>;
export type UncertainQtyField = z.infer<typeof UncertainQtyFieldSchema>;

/** Ligne extraite du BL par l'IA avec incertitude par champ. */
export const BLExtractedUncertainLineSchema = z.object({
  name: UncertainStringFieldSchema,
  ean: UncertainStringFieldSchema,
  expected_qty: UncertainQtyFieldSchema,
  dlc: UncertainStringFieldSchema,
});

export const BLUncertainExtractionSchema = z.object({
  lines: z.array(BLExtractedUncertainLineSchema).min(1),
});

export type BLExtractedUncertainLine = z.infer<
  typeof BLExtractedUncertainLineSchema
>;
export type BLUncertainExtraction = z.infer<typeof BLUncertainExtractionSchema>;

/** @deprecated Utiliser BLUncertainExtractionSchema côté extraction IA. */
export const BLExtractedLineSchema = z.object({
  name: z.string().min(1),
  ean: z.string().min(1),
  expected_qty: z.number().int().positive(),
  dlc: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const BLExtractionSchema = z.object({
  lines: z.array(BLExtractedLineSchema).min(1),
});

export type BLExtractedLine = z.infer<typeof BLExtractedLineSchema>;
export type BLExtraction = z.infer<typeof BLExtractionSchema>;

export const UNREADABLE_LINE_NAME = "Ligne illisible";

export type NormalizedBlLine = {
  raw_name: string;
  ean: string | null;
  expected_qty: number;
  dlc: string | null;
  needs_review: boolean;
};

export const AnalyzeBLResultSchema = z.object({
  deliveryId: z.string().uuid(),
  status: z.literal("draft"),
  lineCount: z.number().int().positive(),
  blFilePath: z.string().min(1),
  needsReviewCount: z.number().int().nonnegative(),
});

export type AnalyzeBLResult = z.infer<typeof AnalyzeBLResultSchema>;

export const RecordScanInputSchema = z.object({
  deliveryId: z.string().uuid(),
  ean: z.string().min(1),
  dlc: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  extra: z.boolean().optional().default(false),
});

export const RecordScanNotInBlSchema = z.object({
  status: z.literal("not_in_bl"),
  ean: z.string(),
});

export type RecordScanNotInBl = z.infer<typeof RecordScanNotInBlSchema>;

export const RecordScanSuccessSchema = z.object({
  status: z.literal("scanned"),
  deliveryId: z.string().uuid(),
  lineId: z.string().uuid(),
  ean: z.string(),
  scannedQty: z.number().int().nonnegative(),
  expectedQty: z.number().int().nonnegative(),
  dlc: z.string().nullable(),
});

export type RecordScanSuccess = z.infer<typeof RecordScanSuccessSchema>;

export const RecordScanResultSchema = z.discriminatedUnion("status", [
  RecordScanNotInBlSchema,
  RecordScanSuccessSchema,
]);

export type RecordScanResult = z.infer<typeof RecordScanResultSchema>;

export const DiscrepancyLineSchema = z.object({
  ean: z.string().nullable(),
  rawName: z.string(),
  expectedQty: z.number().int().nonnegative(),
  scannedQty: z.number().int().nonnegative(),
  kind: z.enum(["missing", "surplus"]),
});

export type DiscrepancyLine = z.infer<typeof DiscrepancyLineSchema>;

export const UnexpectedLineSchema = z.object({
  ean: z.string(),
  rawName: z.string(),
  scannedQty: z.number().int().positive(),
});

export type UnexpectedLine = z.infer<typeof UnexpectedLineSchema>;

export const SupplierEmailDraftSchema = z.object({
  to: z.string().email().nullable(),
  subject: z.string(),
  body: z.string(),
});

export const FinalizeDeliveryReportSchema = z.object({
  status: z.enum(["completed", "discrepancy"]),
  deliveryId: z.string().uuid(),
  batchesCreated: z.number().int().nonnegative(),
  discrepancies: z.array(DiscrepancyLineSchema),
  unexpected: z.array(UnexpectedLineSchema),
  draftEmail: SupplierEmailDraftSchema.optional(),
});

export type FinalizeDeliveryReport = z.infer<typeof FinalizeDeliveryReportSchema>;

export const ProductLookupSchema = z.object({
  id: z.string().uuid(),
  ean: z.string(),
  name: z.string(),
  has_dlc: z.boolean(),
});

export type ProductLookup = z.infer<typeof ProductLookupSchema>;

export const DeliveryLineRowSchema = z.object({
  id: z.string().uuid(),
  delivery_id: z.string().uuid(),
  product_id: z.string().uuid().nullable(),
  raw_name: z.string(),
  ean: z.string().nullable(),
  expected_qty: z.number().int(),
  scanned_qty: z.number().int(),
  dlc: z.string().nullable(),
  needs_review: z.boolean().optional().default(false),
});

export type DeliveryLineRow = z.infer<typeof DeliveryLineRowSchema>;

export const ConfirmReviewResultSchema = z.object({
  deliveryId: z.string().uuid(),
  status: z.literal("scanning"),
});

export type ConfirmReviewResult = z.infer<typeof ConfirmReviewResultSchema>;

/** @deprecated Utiliser FinalizeDeliveryReportSchema */
export const FinalizeDeliveryResultSchema = FinalizeDeliveryReportSchema;
export type FinalizeDeliveryResult = FinalizeDeliveryReport;

export function formatEanForReport(ean: string | null): string {
  return ean ?? "EAN non lu";
}
