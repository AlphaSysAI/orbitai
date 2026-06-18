export {
  getWeather,
} from "@/features/regiaire/verdict/signals/weather";
export {
  getSchoolHolidayStatus,
} from "@/features/regiaire/verdict/signals/school-holidays";
export {
  buildTrendWindows,
  alignedLastYear,
} from "@/features/regiaire/verdict/trends/build-trend-windows";
export {
  getStationSettings,
  requireStationSettings,
} from "@/features/regiaire/verdict/station-settings-access";
export type {
  WeatherForecast,
  WeatherDay,
  SchoolHolidayStatus,
  SchoolZone,
  TrendWindows,
  StationSettings,
} from "@/features/regiaire/verdict/schemas";
export { TREND_WINDOW_DAYS } from "@/features/regiaire/verdict/schemas";
