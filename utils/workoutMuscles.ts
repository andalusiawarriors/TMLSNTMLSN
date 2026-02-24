// ============================================================
// TMLSN — Convert workout sessions to muscle tracking data
// ============================================================

import { WorkoutSession } from '../types';
import { SetRecord } from './exerciseDb/types';
import { EXERCISE_DATABASE, EXERCISE_MAP } from './exerciseDb/exerciseDatabase';
import { getDayOfWeek } from './weeklyMuscleTracker';

// Explicit mappings for TMLSN splits and common names
const EXPLICIT_NAME_MAP: Record<string, string> = {
  'bench press': 'flat_barbell_bench',
  'barbell row': 'barbell_row',
  'overhead press': 'overhead_press',
  'pull-ups': 'pull_up',
  'pull ups': 'pull_up',
  'dumbbell flyes': 'flat_dumbbell_fly',
  'face pulls': 'face_pull',
  'squat': 'back_squat',
  'romanian deadlift': 'romanian_deadlift',
  'leg press': 'leg_press',
  'leg curl': 'lying_leg_curl',
  'calf raises': 'standing_calf_raise',
  'incline dumbbell press': 'incline_dumbbell_bench',
  'lat pulldown': 'lat_pulldown',
  'dumbbell shoulder press': 'dumbbell_shoulder_press',
  'cable row': 'cable_row_seated',
  'lateral raises': 'lateral_raise_dumbbell',
  'bicep curls': 'dumbbell_curl',
  'tricep extensions': 'overhead_dumbbell_extension',
  'deadlift': 'deadlift_conventional',
  'front squat': 'front_squat',
  'bulgarian split squat': 'bulgarian_split_squat',
  'leg extension': 'leg_extension',
  'seated calf raises': 'seated_calf_raise',
};

// Map common exercise names to DB ids (case-insensitive partial match)
const NAME_TO_DB_ID = new Map<string, string>();
for (const [name, id] of Object.entries(EXPLICIT_NAME_MAP)) {
  NAME_TO_DB_ID.set(name, id);
}
for (const ex of EXERCISE_DATABASE) {
  const key = ex.name.toLowerCase().trim();
  if (!NAME_TO_DB_ID.has(key)) NAME_TO_DB_ID.set(key, ex.id);
}

function matchExerciseToDbId(name: string, exerciseDbId?: string): string | null {
  if (exerciseDbId && EXERCISE_MAP.has(exerciseDbId)) return exerciseDbId;
  const key = name.toLowerCase().trim();
  const exact = NAME_TO_DB_ID.get(key);
  if (exact) return exact;
  // Fuzzy: find best match by contains
  for (const ex of EXERCISE_DATABASE) {
    if (ex.name.toLowerCase().includes(key) || key.includes(ex.name.toLowerCase())) {
      return ex.id;
    }
  }
  return null;
}

/** Resolve exercise name to DB id for heatmap/muscle mapping when exerciseDbId is missing. */
export function resolveExerciseDbIdFromName(name: string): string | null {
  return matchExerciseToDbId(name);
}

/**
 * Convert completed workout sessions to SetRecords for the current week.
 * Only includes completed sets from exercises that match the DB.
 */
export function workoutsToSetRecords(
  sessions: WorkoutSession[],
  weekStart: Date
): SetRecord[] {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const records: SetRecord[] = [];
  for (const session of sessions) {
    if (!session.isComplete) continue;
    const sessionDate = new Date(session.date);
    if (Number.isNaN(sessionDate.getTime())) continue;
    if (sessionDate < weekStart || sessionDate >= weekEnd) continue;

    const dayOfWeek = getDayOfWeek(sessionDate);

    for (const exercise of session.exercises ?? []) {
      const dbId = matchExerciseToDbId(exercise.name, exercise.exerciseDbId);
      if (!dbId) continue;

      const completedSets = (exercise.sets ?? []).filter((set) => set.completed);
      if (completedSets.length === 0) continue;

      for (const set of completedSets) {
        records.push({
          exerciseId: dbId,
          reps: set.reps,
          weight: set.weight > 0 ? set.weight : undefined,
          date: session.date,
          dayOfWeek,
        });
      }
    }
  }

  return records;
}
