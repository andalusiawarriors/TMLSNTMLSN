/**
 * Day-of-week and date helpers using local device time.
 * Deterministic: uses Date.getDay() and manual formatting to avoid
 * UTC/timezone bugs (e.g. toISOString, Metro debugger host timezone).
 */

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type DayName = (typeof DAYS)[number];

/**
 * Returns "Monday".."Sunday" using DAYS array and Date.getDay().
 * Deterministic, no toLocaleDateString.
 */
export function getLocalDayName(): DayName {
  return DAYS[new Date().getDay()];
}

/**
 * Returns YYYY-MM-DD in local time without toISOString().
 */
export function formatLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Returns most recent Monday in local time as YYYY-MM-DD.
 */
export function getLocalMondayYMD(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return formatLocalYMD(monday);
}

/**
 * Returns "Monday".."Sunday" for Europe/Copenhagen timezone.
 */
export function getCopenhagenDayName(): DayName {
  const name = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'Europe/Copenhagen',
  });
  return DAYS.includes(name as DayName) ? (name as DayName) : DAYS[new Date().getDay()];
}
