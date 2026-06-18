import { z } from "zod";

export const SchoolZoneSchema = z.enum(["A", "B", "C"]);
export type SchoolZone = z.infer<typeof SchoolZoneSchema>;

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const WeatherDaySchema = z.object({
  date: IsoDateSchema,
  weatherCode: z.number().int(),
  tempMaxC: z.number(),
  tempMinC: z.number(),
  precipitationMm: z.number(),
  precipitationProbMax: z.number().nullable(),
});

export type WeatherDay = z.infer<typeof WeatherDaySchema>;

export const WeatherForecastSchema = z.object({
  location: z.object({
    lat: z.number(),
    lon: z.number(),
    city: z.string().nullable(),
  }),
  /** Jour courant + J+1, J+2, J+3 */
  days: z.array(WeatherDaySchema).min(1).max(4),
  fetchedAt: z.string().datetime(),
});

export type WeatherForecast = z.infer<typeof WeatherForecastSchema>;

export const SchoolHolidayStatusSchema = z.object({
  date: IsoDateSchema,
  schoolZone: SchoolZoneSchema,
  isOnHoliday: z.boolean(),
  label: z.string().nullable(),
});

export type SchoolHolidayStatus = z.infer<typeof SchoolHolidayStatusSchema>;

export const TrendQuantityMapSchema = z.record(z.string(), z.number().nonnegative());

export const TrendWindowSliceSchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  days: z.array(IsoDateSchema),
  byProduct: TrendQuantityMapSchema,
  byCategory: TrendQuantityMapSchema,
});

export type TrendWindowSlice = z.infer<typeof TrendWindowSliceSchema>;

export const TrendWindowsSchema = z.object({
  organizationId: z.string().uuid(),
  targetDate: IsoDateSchema,
  windowDays: z.number().int().positive(),
  current: TrendWindowSliceSchema,
  lastYear: TrendWindowSliceSchema.extend({
    alignedTargetDate: IsoDateSchema,
  }),
});

export type TrendWindows = z.infer<typeof TrendWindowsSchema>;

export const TREND_WINDOW_DAYS = 15;

export const StationSettingsSchema = z.object({
  organizationId: z.string().uuid(),
  lat: z.number(),
  lon: z.number(),
  city: z.string().nullable(),
  schoolZone: SchoolZoneSchema,
  orderDays: z.array(z.number().int().min(1).max(7)),
});

export type StationSettings = z.infer<typeof StationSettingsSchema>;

export const WeatherSignalSchema = z.object({
  available: z.boolean(),
  forecast: WeatherForecastSchema.optional(),
  reason: z.string().optional(),
});

export type WeatherSignal = z.infer<typeof WeatherSignalSchema>;

export const SchoolHolidaySignalSchema = z.object({
  available: z.boolean(),
  status: SchoolHolidayStatusSchema.optional(),
  reason: z.string().optional(),
});

export type SchoolHolidaySignal = z.infer<typeof SchoolHolidaySignalSchema>;

export const TrafficSignalSchema = z.object({
  available: z.boolean(),
  signalDate: IsoDateSchema,
  footfallIndex: z.number().optional(),
  reason: z.string().optional(),
});

export type TrafficSignal = z.infer<typeof TrafficSignalSchema>;

export const TrendCategorySummarySchema = z.object({
  category: z.string(),
  current15d: z.number().nonnegative(),
  lastYear15d: z.number().nonnegative(),
  deltaPct: z.number().nullable(),
});

export type TrendCategorySummary = z.infer<typeof TrendCategorySummarySchema>;

export const AffluenceAttendueSchema = z.enum(["faible", "normale", "forte"]);
export type AffluenceAttendue = z.infer<typeof AffluenceAttendueSchema>;

export const RayonRecommendationSchema = z.object({
  category: z.string(),
  direction: z.enum(["augmenter", "maintenir", "reduire"]),
  emphase: z.enum(["forte", "moderee", "legere"]),
  justification: z.string().max(220),
});

export type RayonRecommendation = z.infer<typeof RayonRecommendationSchema>;

export const TopMouvementSchema = z.object({
  category: z.string(),
  deltaPct: z.number().nullable(),
  direction: z.enum(["hausse", "baisse", "stable"]),
  justification: z.string().max(180),
});

export type TopMouvement = z.infer<typeof TopMouvementSchema>;

export const VerdictRecommendationSchema = z.object({
  affluence_attendue: AffluenceAttendueSchema,
  rayons: z.array(RayonRecommendationSchema).min(1),
  top_mouvements: z.array(TopMouvementSchema).min(1).max(5),
  synthese: z.string().max(500).optional(),
});

export type VerdictRecommendation = z.infer<typeof VerdictRecommendationSchema>;

export const VerdictSignalsSnapshotSchema = z.object({
  runDate: IsoDateSchema,
  station: z.object({
    city: z.string().nullable(),
    schoolZone: SchoolZoneSchema,
    orderDays: z.array(z.number().int().min(1).max(7)),
  }),
  weather: WeatherSignalSchema,
  schoolHoliday: SchoolHolidaySignalSchema,
  traffic: TrafficSignalSchema,
  trendsSummary: z.array(TrendCategorySummarySchema),
});

export type VerdictSignalsSnapshot = z.infer<typeof VerdictSignalsSnapshotSchema>;

export const VerdictRunSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  runDate: IsoDateSchema,
  signals: VerdictSignalsSnapshotSchema,
  recommendation: VerdictRecommendationSchema,
  createdBy: z.string().uuid(),
  createdAt: z.string(),
});

export type VerdictRun = z.infer<typeof VerdictRunSchema>;

export const ExpiringStockItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  category: z.string().nullable(),
  quantity: z.number().int().positive(),
  dlc: IsoDateSchema,
  joursRestants: z.number().int(),
  urgency: z.enum(["perime", "j1", "j2", "j3"]),
});

export type ExpiringStockItem = z.infer<typeof ExpiringStockItemSchema>;

export const ExpiringStockResultSchema = z.object({
  targetDate: IsoDateSchema,
  perimes: z.array(ExpiringStockItemSchema),
  proches: z.array(ExpiringStockItemSchema),
});

export type ExpiringStockResult = z.infer<typeof ExpiringStockResultSchema>;
