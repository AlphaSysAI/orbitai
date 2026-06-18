export {
  getWeather,
  getWeatherForecast,
} from "@/features/regiaire/verdict/signals/weather";
export {
  getSchoolHolidayStatus,
} from "@/features/regiaire/verdict/signals/school-holidays";
export { getTrafficForDate } from "@/features/regiaire/verdict/signals/traffic";
export {
  buildTrendWindows,
  alignedLastYear,
} from "@/features/regiaire/verdict/trends/build-trend-windows";
export {
  getStationSettings,
  requireStationSettings,
} from "@/features/regiaire/verdict/station-settings-access";
export {
  getStationSettingsAction,
  upsertStationSettings,
  generateVerdict,
  getExpiringStock,
  type GenerateVerdictActionResult,
  type GetStationSettingsActionResult,
  type UpsertStationSettingsActionResult,
  type GetExpiringStockActionResult,
} from "@/features/regiaire/verdict/actions";
export type {
  WeatherForecast,
  WeatherDay,
  WeatherSignal,
  SchoolHolidayStatus,
  SchoolHolidaySignal,
  TrafficSignal,
  SchoolZone,
  TrendWindows,
  TrendCategorySummary,
  StationSettings,
  VerdictRecommendation,
  VerdictRun,
  VerdictSignalsSnapshot,
  AffluenceAttendue,
  RayonRecommendation,
  TopMouvement,
  ExpiringStockResult,
  ExpiringStockItem,
} from "@/features/regiaire/verdict/schemas";
export { TREND_WINDOW_DAYS } from "@/features/regiaire/verdict/schemas";
