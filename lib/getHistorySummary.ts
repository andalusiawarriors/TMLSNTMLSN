/**
 * Global workout history summary for JARVIS.
 * Reads from workout_sessions + workout_exercises + workout_sets (the actual storage).
 */

import { supabase } from '@/lib/supabase';
import { uuidToExerciseName, toExerciseUuid } from '@/lib/getTmlsnTemplate';
import { resolveExerciseDbIdFromName } from '@/utils/workoutMuscles';
import type { RecentSession, ExerciseTrend, Adherence } from './getWorkoutContext';

const EMPTY_SUMMARY = {
  recentSessions: [] as RecentSession[],
  exerciseTrends: [] as ExerciseTrend[],
  adherence: { sessions7d: 0, sessions28d: 0, lastWorkoutDate: null } as Adherence,
  recentSessionCount: 0,
  lastSessionDate: null as string | null,
};

function safeAwait<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

const EPLEY_E1RM = (weight: number, reps: number): number =>
  weight * (1 + reps / 30);

function bestSetE1rm(rows: Array<{ weight: number | null; reps: number | null }>): number | null {
  let best = 0;
  for (const r of rows) {
    const w = r.weight ?? 0;
    const reps = r.reps ?? 0;
    if (w > 0 && reps > 0) {
      const e1rm = EPLEY_E1RM(w, reps);
      if (e1rm > best) best = e1rm;
    }
  }
  return best > 0 ? best : null;
}

function bestSet(rows: Array<{ weight: number | null; reps: number | null; rpe: number | null }>) {
  let best: { weight: number | null; reps: number | null; rpe: number | null } | null = null;
  let bestScore = 0;
  for (const r of rows) {
    const w = r.weight ?? 0;
    const reps = r.reps ?? 0;
    const score = w * (reps > 0 ? reps : 1);
    if (score > bestScore) {
      bestScore = score;
      best = { weight: r.weight, reps: r.reps, rpe: r.rpe };
    }
  }
  return best;
}

/** Resolve exercise_db_id or name to canonical UUID for display. */
function toCanonicalUuid(dbId: string | null, name: string): string {
  if (dbId) return toExerciseUuid(dbId);
  const resolved = resolveExerciseDbIdFromName(name);
  return resolved ? toExerciseUuid(resolved) : toExerciseUuid(name);
}

type SessionRow = { id: string; workout_time: string };
type ExerciseRow = { id: string; session_id: string; exercise_db_id: string | null; name: string };
type SetRow = { session_id: string; exercise_id: string; weight: number; reps: number; rpe: number | null };

type TrainingSettingsFilter = { scheduleMode?: string | null; volumeFramework?: string } | null;

/** Fetch raw workout data from workout_sessions + workout_exercises + workout_sets. */
async function fetchWorkoutData(
  userId: string,
  limitSessions = 30,
  trainingSettings?: TrainingSettingsFilter
) {
  if (!supabase) return { sessions: [] as SessionRow[], exercises: [] as ExerciseRow[], sets: [] as SetRow[] };

  const isTmlsn =
    trainingSettings?.scheduleMode === 'tmlsn' ||
    trainingSettings?.scheduleMode === 'tmlsn_protocol' ||
    trainingSettings?.volumeFramework === 'tmlsn_protocol';

  let query = supabase
    .from('workout_sessions')
    .select('id, workout_time')
    .eq('user_id', userId)
    .order('workout_time', { ascending: false })
    .limit(limitSessions);

  if (isTmlsn) {
    query = query.eq('schedule_mode', 'tmlsn_protocol') as typeof query;
  }

  const { data: sessionsData } = await query;

  const sessions = (sessionsData ?? []) as SessionRow[];
  if (sessions.length === 0) return { sessions, exercises: [] as ExerciseRow[], sets: [] as SetRow[] };

  const sessionIds = sessions.map((s) => s.id);

  const { data: exercisesData } = await supabase
    .from('workout_exercises')
    .select('id, session_id, exercise_db_id, name')
    .eq('user_id', userId)
    .in('session_id', sessionIds);

  const exercises = (exercisesData ?? []) as ExerciseRow[];
  const exerciseIds = exercises.map((e) => e.id);

  const { data: setsData } = await supabase
    .from('workout_sets')
    .select('session_id, exercise_id, weight, reps, rpe')
    .eq('user_id', userId)
    .in('session_id', sessionIds);

  const sets = (setsData ?? []) as SetRow[];
  const exIdToCanonical = new Map<string, string>();
  const exIdToName = new Map<string, string>();
  for (const ex of exercises) {
    const canonical = toCanonicalUuid(ex.exercise_db_id, ex.name);
    exIdToCanonical.set(ex.id, canonical);
    exIdToName.set(ex.id, ex.name);
  }

  return { sessions, exercises, sets, exIdToCanonical };
}

/** Extract YYYY-MM-DD from workout_time. */
function toSessionDate(workoutTime: string): string {
  if (!workoutTime) return '';
  const d = new Date(workoutTime);
  return d.toISOString().slice(0, 10);
}

/** Last 14 distinct session dates, set counts + unique exercise count per date. */
export async function getRecentSessions(
  userId: string,
  trainingSettings?: TrainingSettingsFilter
): Promise<RecentSession[]> {
  const { sessions, exercises, sets, exIdToCanonical } = await fetchWorkoutData(userId, 30, trainingSettings);
  if (sessions.length === 0) return [];

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const exercisesBySession = new Map<string, ExerciseRow[]>();
  for (const ex of exercises) {
    if (!exercisesBySession.has(ex.session_id)) exercisesBySession.set(ex.session_id, []);
    exercisesBySession.get(ex.session_id)!.push(ex);
  }

  const byDate = new Map<string, { exerciseIds: Set<string>; setCount: number }>();
  const seenDates: string[] = [];

  for (const session of sessions) {
    const date = toSessionDate(session.workout_time);
    if (!date) continue;
    if (!byDate.has(date)) {
      seenDates.push(date);
      byDate.set(date, { exerciseIds: new Set(), setCount: 0 });
    }
    const entry = byDate.get(date)!;
    const sessionExercises = exercisesBySession.get(session.id) ?? [];
    for (const ex of sessionExercises) {
      const canonical = exIdToCanonical.get(ex.id);
      if (canonical) entry.exerciseIds.add(canonical);
    }
    const sessionSets = sets.filter((s) => s.session_id === session.id);
    entry.setCount += sessionSets.length;
  }

  const distinctDates = [...new Set(seenDates)].slice(0, 14);
  const result: RecentSession[] = [];
  for (const date of distinctDates) {
    const entry = byDate.get(date);
    if (!entry) continue;
    const topExercises = [...entry.exerciseIds].slice(0, 5).map((id) => uuidToExerciseName(id));
    result.push({
      sessionDate: date,
      exerciseCount: entry.exerciseIds.size,
      totalSets: entry.setCount,
      topExercises,
    });
  }
  return result;
}

/** Top ~8 most trained exercises in last 28 days; e1rm trend (last 6 points), set count. */
export async function getExerciseTrends(
  userId: string,
  trainingSettings?: TrainingSettingsFilter
): Promise<ExerciseTrend[]> {
  const { sessions, exercises, sets, exIdToCanonical } = await fetchWorkoutData(userId, 30, trainingSettings);
  if (sessions.length === 0) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 28);
  const cutoffYMD = cutoff.toISOString().slice(0, 10);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  const setCountByCanonical = new Map<string, number>();
  const byCanonicalDate = new Map<string, Map<string, Array<{ weight: number | null; reps: number | null; rpe: number | null }>>>();

  for (const s of sets) {
    const session = sessionById.get(s.session_id);
    if (!session) continue;
    const date = toSessionDate(session.workout_time);
    if (date < cutoffYMD) continue;

    const ex = exercises.find((e) => e.id === s.exercise_id);
    const canonical = ex ? exIdToCanonical.get(ex.id) : null;
    if (!canonical) continue;

    setCountByCanonical.set(canonical, (setCountByCanonical.get(canonical) ?? 0) + 1);
    if (!byCanonicalDate.has(canonical)) byCanonicalDate.set(canonical, new Map());
    const dateMap = byCanonicalDate.get(canonical)!;
    if (!dateMap.has(date)) dateMap.set(date, []);
    dateMap.get(date)!.push({
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      rpe: s.rpe ?? null,
    });
  }

  const topCanonical = [...setCountByCanonical.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);

  const result: ExerciseTrend[] = [];
  for (const exerciseId of topCanonical) {
    const setCount4w = setCountByCanonical.get(exerciseId) ?? 0;
    const dateMap = byCanonicalDate.get(exerciseId);
    if (!dateMap) continue;

    const dates = [...dateMap.keys()].sort((a, b) => b.localeCompare(a));
    const e1rmTrend: Array<{ sessionDate: string; e1rm: number }> = [];
    for (const date of dates.slice(0, 6)) {
      const setList = dateMap.get(date) ?? [];
      const e1rm = bestSetE1rm(setList);
      if (e1rm != null) e1rmTrend.push({ sessionDate: date, e1rm });
    }

    const lastSessionDate = dates[0] ?? null;
    const lastSets = lastSessionDate ? dateMap.get(lastSessionDate) ?? [] : [];
    const lastTopSet = lastSets.length > 0 ? bestSet(lastSets) : null;

    result.push({
      exerciseId,
      exerciseName: uuidToExerciseName(exerciseId),
      lastSessionDate,
      lastTopSet,
      e1rmTrend,
      setCount4w,
    });
  }
  return result;
}

/** Sessions in last 7 and 28 days, last workout date. */
export async function getAdherence(
  userId: string,
  trainingSettings?: TrainingSettingsFilter
): Promise<Adherence> {
  const { sessions } = await fetchWorkoutData(userId, 30, trainingSettings);
  if (sessions.length === 0) {
    return { sessions7d: 0, sessions28d: 0, lastWorkoutDate: null };
  }

  const now = new Date();
  const cutoff7 = new Date(now);
  cutoff7.setDate(cutoff7.getDate() - 7);
  const cutoff28 = new Date(now);
  cutoff28.setDate(cutoff28.getDate() - 28);
  const cutoff7YMD = cutoff7.toISOString().slice(0, 10);
  const cutoff28YMD = cutoff28.toISOString().slice(0, 10);

  const dates = sessions.map((s) => toSessionDate(s.workout_time)).filter(Boolean);
  const distinctDates = [...new Set(dates)].filter((d) => d >= cutoff28YMD);
  const lastWorkoutDate = distinctDates[0] ?? (dates[0] || null);
  const sessions7d = distinctDates.filter((d) => d >= cutoff7YMD).length;
  const sessions28d = distinctDates.length;

  return { sessions7d, sessions28d, lastWorkoutDate };
}

export interface HistorySummary {
  recentSessions: RecentSession[];
  exerciseTrends: ExerciseTrend[];
  adherence: Adherence;
  recentSessionCount: number;
  lastSessionDate: string | null;
}

export async function getHistorySummary(
  userId: string | null,
  trainingSettings?: TrainingSettingsFilter
): Promise<HistorySummary> {
  if (userId == null || userId === '') {
    return { ...EMPTY_SUMMARY };
  }
  try {
    const result = await safeAwait(
      (async () => {
        const [recentSessions, exerciseTrends, adherence] = await Promise.all([
          getRecentSessions(userId, trainingSettings),
          getExerciseTrends(userId, trainingSettings),
          getAdherence(userId, trainingSettings),
        ]);
        const lastSessionDate = adherence.lastWorkoutDate ?? recentSessions[0]?.sessionDate ?? null;
        return {
          recentSessions,
          exerciseTrends,
          adherence,
          recentSessionCount: recentSessions.length,
          lastSessionDate,
        };
      })().catch(() => null),
      4000
    );
    if (result == null) return { ...EMPTY_SUMMARY };
    return result;
  } catch {
    return { ...EMPTY_SUMMARY };
  }
}
