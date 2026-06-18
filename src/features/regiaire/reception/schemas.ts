import { z } from "zod";

export const DeliveryStatusSchema = z.enum([
  "draft",
  "scanning",
  "discrepancy",
  "completed",
]);

export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

/** Ligne extraite du BL par l'IA (avant persistance). */
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

export const AnalyzeBLResultSchema = z.object({
  deliveryId: z.string().uuid(),
  status: z.literal("scanning"),
  lineCount: z.number().int().positive(),
  blFilePath: z.string().min(1),
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

export const RecordScanResultSchema = z.object({
  deliveryId: z.string().uuid(),
  lineId: z.string().uuid(),
  ean: z.string(),
  scannedQty: z.number().int().nonnegative(),
  expectedQty: z.number().int().nonnegative(),
  dlc: z.string().nullable(),
});

export type RecordScanResult = z.infer<typeof RecordScanResultSchema>;

export const DiscrepancyLineSchema = z.object({
  ean: z.string(),
  rawName: z.string(),
  expectedQty: z.number().int().nonnegative(),
  scannedQty: z.number().int().nonnegative(),
  kind: z.enum(["missing", "surplus"]),
});

export type DiscrepancyLine = z.infer<typeof DiscrepancyLineSchema>;

export const SupplierEmailDraftSchema = z.object({
  to: z.string().email().nullable(),
  subject: z.string(),
  body: z.string(),
});

export const FinalizeDeliveryCompletedSchema = z.object({
  status: z.literal("completed"),
  deliveryId: z.string().uuid(),
  batchesCreated: z.number().int().nonnegative(),
});

export const FinalizeDeliveryDiscrepancySchema = z.object({
  status: z.literal("discrepancy"),
  deliveryId: z.string().uuid(),
  discrepancies: z.array(DiscrepancyLineSchema),
  draftEmail: SupplierEmailDraftSchema,
});

export const FinalizeDeliveryResultSchema = z.discriminatedUnion("status", [
  FinalizeDeliveryCompletedSchema,
  FinalizeDeliveryDiscrepancySchema,
]);

export type FinalizeDeliveryResult = z.infer<typeof FinalizeDeliveryResultSchema>;

export const DeliveryLineRowSchema = z.object({
  id: z.string().uuid(),
  delivery_id: z.string().uuid(),
  product_id: z.string().uuid().nullable(),
  raw_name: z.string(),
  ean: z.string(),
  expected_qty: z.number().int(),
  scanned_qty: z.number().int(),
  dlc: z.string().nullable(),
});

export type DeliveryLineRow = z.infer<typeof DeliveryLineRowSchema>;
