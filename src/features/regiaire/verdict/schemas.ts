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
