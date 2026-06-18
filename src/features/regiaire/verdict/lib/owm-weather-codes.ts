/**
 * Mappe les condition.id OpenWeatherMap vers nos codes internes (libellés + icônes).
 * @see https://openweathermap.org/weather-conditions
 */
export function mapOwmConditionToWeatherCode(owmId: number): number {
  if (owmId === 800) return 0;
  if (owmId === 801) return 1;
  if (owmId === 802) return 2;
  if (owmId === 803 || owmId === 804) return 3;
  if (owmId >= 700 && owmId < 800) return 45;
  if (owmId >= 300 && owmId < 400) return 51;
  if (owmId >= 500 && owmId < 600) {
    if (owmId >= 520 && owmId <= 531) return 80;
    if (owmId >= 502) return 63;
    return 61;
  }
  if (owmId >= 200 && owmId < 300) return 95;
  if (owmId >= 600 && owmId < 700) return 3;
  return 2;
}
