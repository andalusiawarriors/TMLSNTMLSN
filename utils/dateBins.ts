// ============================================================
// TMLSN — Calendar heatmap data utilities
// Builds date grids and aggregates workout sessions for the
// GitHub-contributions-style calendar heatmap.
// ============================================================

import type { WorkoutSession } from '../types';

export type HeatmapPeriod = 'week' | 'month' | 'year' | 'all';
export type CalendarMetric = 'workouts' | 'volume';

export interface CalendarBin {
  dateKey: string;   // YYYY-MM-DD
  date: Date;
  weekIndex: number; // column (0 = leftmost week)
  dayIndex: number;  // row (0 = Mon, 6 = Sun)
}

/** Monday-based day index (0 = Mon, 6 = Sun). */
function mondayDayIndex(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getMondayOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function getPeriodRange(
  period: HeatmapPeriod,
  sessions: WorkoutSession[],
): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const end = new Date(today);
  end.setDate(end.getDate() + 1);

  switch (period) {
    case 'week': {
      const start = getMondayOfWeek(today);
      return { start, end };
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start, end };
    }
    case 'year': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start, end };
    }
    case 'all': {
      if (sessions.length === 0) {
        const start = new Date(today.getFullYear(), 0, 1);
        return { start, end };
      }
      let earliest = today;
      for (const s of sessions) {
        const d = new Date(s.date);
        if (!isNaN(d.getTime()) && d < earliest) earliest = d;
      }
      const start = getMondayOfWeek(earliest);
      return { start, end };
    }
  }
}

/**
 * Build a grid of date bins for the calendar heatmap.
 * Each bin has a weekIndex (column) and dayIndex (row, Mon=0 Sun=6).
 */
export function buildCalendarBins(
  period: HeatmapPeriod,
  sessions: WorkoutSession[],
): CalendarBin[] {
  const { start, end } = getPeriodRange(period, sessions);
  const firstMonday = getMondayOfWeek(start);
  const bins: CalendarBin[] = [];

  const cursor = new Date(firstMonday);
  while (cursor < end) {
    const dayIdx = mondayDayIndex(cursor);
    const diffDays = Math.round(
      (cursor.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24),
    );
    const weekIdx = Math.floor(diffDays / 7);

    bins.push({
      dateKey: toDateKey(cursor),
      date: new Date(cursor),
      weekIndex: weekIdx,
      dayIndex: dayIdx,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return bins;
}

/**
 * Aggregate sessions by date key.
 * 'workouts' = count of completed sessions per day.
 * 'volume'   = sum(weight * reps) across all completed sets per day.
 */
export function aggregateSessionsByDay(
  sessions: WorkoutSession[],
  metric: CalendarMetric,
): Map<string, number> {
  const map = new Map<string, number>();

  for (const session of sessions) {
    if (!session.isComplete) continue;
    const d = new Date(session.date);
    if (isNaN(d.getTime())) continue;
    const key = toDateKey(d);

    if (metric === 'workouts') {
      map.set(key, (map.get(key) ?? 0) + 1);
    } else {
      let volume = 0;
      for (const ex of session.exercises ?? []) {
        for (const set of ex.sets ?? []) {
          if (set.completed) {
            volume += (set.weight > 0 ? set.weight : 0) * set.reps;
          }
        }
      }
      map.set(key, (map.get(key) ?? 0) + volume);
    }
  }

  return map;
}

/**
 * Compute bucket thresholds for N intensity levels using quantile-ish splits.
 * Returns an array of (levels - 1) thresholds.
 * Level 0 = value is 0. Levels 1..N map to thresholds.
 */
export function bucketize(values: number[], levels: number = 5): number[] {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return Array(levels - 1).fill(1);

  const thresholds: number[] = [];
  for (let i = 1; i < levels; i++) {
    const idx = Math.min(
      nonZero.length - 1,
      Math.floor((i / levels) * nonZero.length),
    );
    thresholds.push(nonZero[idx]);
  }

  return thresholds;
}

/**
 * Get the intensity level (0..levels-1) for a value given thresholds.
 * 0 means no activity.
 */
export function getLevel(value: number, thresholds: number[]): number {
  if (value <= 0) return 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (value <= thresholds[i]) return i + 1;
  }
  return thresholds.length;
}

/** Extract unique month labels and their starting week index for axis labels. */
export function getMonthLabels(
  bins: CalendarBin[],
): { label: string; weekIndex: number }[] {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const seen = new Set<string>();
  const labels: { label: string; weekIndex: number }[] = [];

  for (const bin of bins) {
    if (bin.dayIndex !== 0) continue; // only check Mondays
    const key = `${bin.date.getFullYear()}-${bin.date.getMonth()}`;
    if (!seen.has(key)) {
      seen.add(key);
      labels.push({ label: MONTHS[bin.date.getMonth()], weekIndex: bin.weekIndex });
    }
  }

  return labels;
}
