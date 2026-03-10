/**
 * On-demand deep dive fetch for JARVIS.
 * Reads from workout_sessions + workout_exercises + workout_sets.
 */

import { uuidToExerciseName, toExerciseUuid } from '@/lib/getTmlsnTemplate';
import { resolveExerciseDbIdFromName } from '@/utils/workoutMuscles';
import * as supabaseStorage from '@/utils/supabaseStorage';

export interface SessionSummary {
  sessionDate: string;
  topSet: { weight: number | null; reps: number | null; rpe: number | null };
  avgReps: number;
  avgRpe: number | null;
}

export interface ExerciseDeepDive {
  exerciseId: string;
  exerciseName: string;
  sessions: SessionSummary[];
}

/** Last 20 sessions for an exercise with top set, average reps, average RPE. */
export async function getExerciseDeepDive(
  userId: string,
  exerciseId: string
): Promise<ExerciseDeepDive | null> {
  const sessions = await supabaseStorage.supabaseGetWorkoutSessions(userId);
  const exerciseName = uuidToExerciseName(exerciseId);

  const byDate = new Map<string, Array<{ weight: number | null; reps: number | null; rpe: number | null }>>();

  for (const session of sessions) {
    const date = session.date?.slice(0, 10) ?? '';
    if (!date) continue;
    for (const ex of session.exercises ?? []) {
      const dbId = ex.exerciseDbId ?? resolveExerciseDbIdFromName(ex.name);
      const canonicalUuid = dbId ? toExerciseUuid(dbId) : toExerciseUuid(ex.name);
      if (canonicalUuid !== exerciseId) continue;
      if (!byDate.has(date)) byDate.set(date, []);
      for (const s of ex.sets ?? []) {
        byDate.get(date)!.push({
          weight: s.weight ?? null,
          reps: s.reps ?? null,
          rpe: s.rpe ?? null,
        });
      }
    }
  }

  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, 20);
  const sessionSummaries: SessionSummary[] = [];

  for (const date of dates) {
    const sets = byDate.get(date) ?? [];
    let topSet: { weight: number | null; reps: number | null; rpe: number | null } = { weight: null, reps: null, rpe: null };
    let bestScore = 0;
    let sumReps = 0;
    let repCount = 0;
    const rpes: number[] = [];

    for (const s of sets) {
      const w = s.weight ?? 0;
      const r = s.reps ?? 0;
      const score = w * (r > 0 ? r : 1);
      if (score > bestScore) {
        bestScore = score;
        topSet = { weight: s.weight, reps: s.reps, rpe: s.rpe };
      }
      if (r > 0) {
        sumReps += r;
        repCount += 1;
      }
      if (s.rpe != null && s.rpe > 0) rpes.push(s.rpe);
    }

    const avgReps = repCount > 0 ? Math.round((sumReps / repCount) * 10) / 10 : 0;
    const avgRpe = rpes.length > 0 ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null;

    sessionSummaries.push({ sessionDate: date, topSet, avgReps, avgRpe });
  }

  if (sessionSummaries.length === 0) return null;

  return {
    exerciseId,
    exerciseName,
    sessions: sessionSummaries,
  };
}

export interface DateRangeSummary {
  fromYMD: string;
  toYMD: string;
  totalSessions: number;
  totalSets: number;
  topExercises: Array<{ name: string; sets: number }>;
}

/** Total sessions, sets, top exercises for a date range. */
export async function getDateRangeSummary(
  userId: string,
  fromYMD: string,
  toYMD: string
): Promise<DateRangeSummary | null> {
  const sessions = await supabaseStorage.supabaseGetWorkoutSessions(userId);
  const sessionDates = new Set<string>();
  const setsByExercise = new Map<string, number>();

  for (const session of sessions) {
    const date = session.date?.slice(0, 10) ?? '';
    if (!date || date < fromYMD || date > toYMD) continue;
    sessionDates.add(date);
    for (const ex of session.exercises ?? []) {
      const dbId = ex.exerciseDbId ?? resolveExerciseDbIdFromName(ex.name);
      const canonicalUuid = dbId ? toExerciseUuid(dbId) : toExerciseUuid(ex.name);
      const name = uuidToExerciseName(canonicalUuid);
      const count = (setsByExercise.get(name) ?? 0) + (ex.sets?.length ?? 0);
      setsByExercise.set(name, count);
    }
  }

  const topExercises = [...setsByExercise.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, sets]) => ({ name, sets }));

  return {
    fromYMD,
    toYMD,
    totalSessions: sessionDates.size,
    totalSets: [...setsByExercise.values()].reduce((a, b) => a + b, 0),
    topExercises,
  };
}

/** Resolve exercise name (e.g. "bench") to exercise UUID for queries. */
export function resolveExerciseIdFromName(name: string): string | null {
  const dbId = resolveExerciseDbIdFromName(name);
  return dbId ? toExerciseUuid(dbId) : null;
}

/** Extract exercise UUID from user message for deep-dive intent. Returns first match. */
const EXERCISE_KEYWORDS = [
  'bench press', 'bench', 'squat', 'deadlift', 'overhead press', 'barbell row',
  'pull-ups', 'pull ups', 'dumbbell flyes', 'face pulls', 'romanian deadlift',
  'leg press', 'leg curl', 'calf raises', 'incline dumbbell press', 'lat pulldown',
  'dumbbell shoulder press', 'cable row', 'lateral raises', 'bicep curls',
  'tricep extensions', 'front squat', 'bulgarian split squat', 'leg extension',
  'seated calf raises', 'press', 'row', 'curl', 'pull', 'lat', 'fly', 'raise',
];

export function extractExerciseIdFromMessage(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const kw of EXERCISE_KEYWORDS) {
    if (lower.includes(kw)) {
      const resolved = resolveExerciseIdFromName(kw);
      if (resolved) return resolved;
    }
  }
  const words = lower.split(/\s+/).filter((w) => w.length > 3);
  for (const w of words) {
    const resolved = resolveExerciseIdFromName(w);
    if (resolved) return resolved;
  }
  return null;
}
