import { supabase } from '@/lib/supabase';
import { getDefaultTmlsnExercises, uuidToExerciseName, workoutTypeToProtocolDay, toExerciseUuid, type ProtocolDay, type TmlsnExercise } from '@/lib/getTmlsnTemplate';
import { getHistorySummary } from '@/lib/getHistorySummary';
import { getLocalDayName, getLocalMondayYMD } from '@/lib/time';
import * as supabaseStorage from '@/utils/supabaseStorage';
import { resolveExerciseDbIdFromName } from '@/utils/workoutMuscles';
import { toDisplayWeight, formatWeightDisplay } from '@/utils/units';
import { KG_PER_LB } from '@/utils/units';

// ─── TMLSN Protocol Schedule (when schedule mode is TMLSN) ─────────────────────
export const TMLSN_PROTOCOL_SCHEDULE = [
  { day: 'Monday', workoutType: 'TMLSN Upper Body A', isRestDay: false },
  { day: 'Tuesday', workoutType: 'TMLSN Lower Body A', isRestDay: false },
  { day: 'Wednesday', workoutType: null, isRestDay: true },
  { day: 'Thursday', workoutType: 'TMLSN Upper Body B', isRestDay: false },
  { day: 'Friday', workoutType: 'TMLSN Lower Body B', isRestDay: false },
  { day: 'Saturday', workoutType: null, isRestDay: true },
  { day: 'Sunday', workoutType: null, isRestDay: true },
] as const;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TrainingSettings {
  volumeFramework: 'builder' | 'tmlsn_protocol' | 'ghost';
  scheduleMode: string | null;
  currentWeek: number;
}

export interface ScheduledSet {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  sessionDate: string;
}

export interface ExerciseHistory {
  exerciseId: string;
  /** Up to 3 most recent sessions, newest first */
  recentSets: ScheduledSet[];
}

export interface AllExerciseEntry {
  exerciseId: string;
  exerciseName: string;
  recentSets: ScheduledSet[];
}

/** History for all TMLSN exercises keyed by ProtocolDay ('Upper A', 'Lower A', etc.) */
export type AllExerciseHistory = Record<string, AllExerciseEntry[]>;

export interface TodayPlan {
  dayOfWeek: string;
  workoutType: string | null;
  exerciseIds: string[];
  exerciseNames: string[];
  isRestDay: boolean;
}

export interface VolumeStatus {
  muscleGroup: string;
  weekStart: string;
  setsDone: number;
  mev: number | null;
  mav: number | null;
  mrv: number | null;
}

/** Lightweight global history summary for JARVIS. */
export interface RecentSession {
  sessionDate: string;
  exerciseCount: number;
  totalSets: number;
  topExercises: string[];
}

export interface ExerciseTrend {
  exerciseId: string;
  exerciseName: string;
  lastSessionDate: string | null;
  lastTopSet: { weight: number | null; reps: number | null; rpe: number | null } | null;
  e1rmTrend: Array<{ sessionDate: string; e1rm: number }>;
  setCount4w: number;
}

export interface Adherence {
  sessions7d: number;
  sessions28d: number;
  lastWorkoutDate: string | null;
}

/** Per-exercise details for JARVIS: ghost, rep range, weight increment. */
export interface TodayExerciseDetail {
  exerciseName: string;
  ghostWeight: string | null;
  ghostReps: string | null;
  repRangeLow: number;
  repRangeHigh: number;
  /** Stored in lb; use for both units with conversion when user uses kg */
  smallestIncrementLb: number;
  smallestIncrementKg: number;
  goal: string | null;
}

export interface WorkoutContext {
  userId: string;
  fetchedAt: string;
  trainingSettings: TrainingSettings | null;
  todayPlan: TodayPlan | null;
  /** null when today is a rest day or no schedule exists */
  exerciseHistory: ExerciseHistory[] | null;
  /** Full history for all TMLSN exercises across all protocol days */
  allExerciseHistory?: AllExerciseHistory;
  weeklyVolume: VolumeStatus[];
  /** When TMLSN protocol is selected: full weekly schedule for JARVIS */
  tmlsnProtocolSchedule?: typeof TMLSN_PROTOCOL_SCHEDULE;
  /** Global history summary — always loaded even when todayPlan is null */
  recentSessions?: RecentSession[];
  exerciseTrends?: ExerciseTrend[];
  adherence?: Adherence;
  /** User's weight unit preference */
  weightUnit?: 'kg' | 'lb';
  /** Per-exercise ghost, rep range, increment for today's exercises */
  todayExerciseDetails?: TodayExerciseDetail[];
}

// ─── All-exercise history fetch (from workout_sessions + workout_sets) ─────────

function toCanonicalExUuid(dbId: string | undefined, name: string): string {
  if (dbId) return toExerciseUuid(dbId);
  const resolved = resolveExerciseDbIdFromName(name);
  return resolved ? toExerciseUuid(resolved) : toExerciseUuid(name);
}

async function fetchAllTmlsnExerciseHistory(
  userId: string,
  _sb: NonNullable<typeof supabase>
): Promise<AllExerciseHistory> {
  const days: ProtocolDay[] = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];
  const exercisesByDay: Partial<Record<ProtocolDay, TmlsnExercise[]>> = {};
  const idSet = new Set<string>();

  for (const day of days) {
    const exs = getDefaultTmlsnExercises(day);
    exercisesByDay[day] = exs;
    for (const e of exs) idSet.add(e.id);
  }

  const sessions = await supabaseStorage.supabaseGetWorkoutSessions(userId);
  const byExercise = new Map<string, Map<string, ScheduledSet[]>>();

  for (const session of sessions) {
    const date = session.date?.slice(0, 10) ?? '';
    if (!date) continue;
    for (const ex of session.exercises ?? []) {
      const canonicalId = toCanonicalExUuid(ex.exerciseDbId, ex.name);
      if (!idSet.has(canonicalId)) continue;
      if (!byExercise.has(canonicalId)) byExercise.set(canonicalId, new Map());
      const dateMap = byExercise.get(canonicalId)!;
      if (!dateMap.has(date)) dateMap.set(date, []);
      for (const s of ex.sets ?? []) {
        dateMap.get(date)!.push({
          weight: s.weight ?? null,
          reps: s.reps ?? null,
          rpe: s.rpe ?? null,
          targetReps: null,
          targetWeight: null,
          sessionDate: date,
        });
      }
    }
  }

  const result: AllExerciseHistory = {};
  for (const day of days) {
    const exs = exercisesByDay[day] ?? [];
    result[day] = exs.map((ex) => {
      const dateMap = byExercise.get(ex.id);
      const recentSets = dateMap
        ? Array.from(dateMap.values()).sort((a, b) => (b[0]?.sessionDate ?? '').localeCompare(a[0]?.sessionDate ?? '')).slice(0, 3).flat()
        : [];
      return { exerciseId: ex.id, exerciseName: ex.name, recentSets };
    });
  }

  return result;
}

/** Build per-exercise details (ghost, rep range, increment) for JARVIS. */
async function buildTodayExerciseDetails(
  userId: string,
  todayPlan: TodayPlan,
  weightUnit: 'kg' | 'lb'
): Promise<TodayExerciseDetail[]> {
  const sessions = await supabaseStorage.supabaseGetWorkoutSessions(userId);
  const prescriptions = await supabaseStorage.supabaseGetExercisePrescriptions(userId, todayPlan.exerciseIds);

  const sortedSessions = [...sessions].sort((a, b) => {
    const da = a.date?.slice(0, 10) ?? '';
    const db = b.date?.slice(0, 10) ?? '';
    return db.localeCompare(da);
  });

  return todayPlan.exerciseIds.map((exerciseId, i) => {
    const exerciseName = todayPlan.exerciseNames?.[i] ?? uuidToExerciseName(exerciseId) ?? 'Unknown';

    let repRangeLow = 8;
    let repRangeHigh = 12;
    let smallestIncrementLb = 2.5;

    for (const session of sortedSessions) {
      const matchEx = session.exercises?.find((e) => e.id === exerciseId || (e.exerciseDbId && toExerciseUuid(e.exerciseDbId) === exerciseId));
      if (matchEx) {
        repRangeLow = matchEx.repRangeLow ?? 8;
        repRangeHigh = matchEx.repRangeHigh ?? 12;
        smallestIncrementLb = matchEx.smallestIncrement ?? 2.5;
        break;
      }
    }

    const smallestIncrementKg = Math.round(smallestIncrementLb * KG_PER_LB * 100) / 100;

    const prescription = prescriptions[exerciseId];
    let ghostWeight: string | null = null;
    let ghostReps: string | null = null;

    if (prescription) {
      ghostWeight = formatWeightDisplay(toDisplayWeight(prescription.nextWeight, weightUnit), weightUnit);
      ghostReps = String(prescription.goal === 'add_load' ? repRangeLow : repRangeHigh);
    }

    if (!ghostWeight || !ghostReps) {
      for (const session of sortedSessions) {
        const matchEx = session.exercises?.find((e) => e.id === exerciseId || (e.exerciseDbId && toExerciseUuid(e.exerciseDbId) === exerciseId));
        if (matchEx) {
          const doneSets = (matchEx.sets ?? []).filter((s) => s.weight > 0 && s.reps > 0);
          if (doneSets.length > 0) {
            const last = doneSets[doneSets.length - 1];
            if (!ghostWeight) ghostWeight = formatWeightDisplay(toDisplayWeight(last.weight, weightUnit), weightUnit);
            if (!ghostReps) ghostReps = String(last.reps);
          }
          break;
        }
      }
    }

    return {
      exerciseName,
      ghostWeight,
      ghostReps,
      repRangeLow,
      repRangeHigh,
      smallestIncrementLb,
      smallestIncrementKg,
      goal: prescription?.goal ?? null,
    };
  });
}

/** Fetch exercise history for given exercise UUIDs from workout_sessions/sets. */
async function fetchExerciseHistoryFromSessions(
  userId: string,
  exerciseIds: string[]
): Promise<ExerciseHistory[]> {
  const sessions = await supabaseStorage.supabaseGetWorkoutSessions(userId);
  const byExercise = new Map<string, Map<string, ScheduledSet[]>>();
  for (const id of exerciseIds) byExercise.set(id, new Map());

  for (const session of sessions) {
    const date = session.date?.slice(0, 10) ?? '';
    if (!date) continue;
    for (const ex of session.exercises ?? []) {
      const canonicalId = toCanonicalExUuid(ex.exerciseDbId, ex.name);
      if (!byExercise.has(canonicalId)) continue;
      const dateMap = byExercise.get(canonicalId)!;
      if (!dateMap.has(date)) dateMap.set(date, []);
      for (const s of ex.sets ?? []) {
        dateMap.get(date)!.push({
          weight: s.weight ?? null,
          reps: s.reps ?? null,
          rpe: s.rpe ?? null,
          targetReps: null,
          targetWeight: null,
          sessionDate: date,
        });
      }
    }
  }

  return exerciseIds.map((exerciseId) => {
    const dateMap = byExercise.get(exerciseId);
    const recentSets = dateMap
      ? Array.from(dateMap.entries())
          .sort((a, b) => b[0].localeCompare(a[0]))
          .slice(0, 3)
          .flatMap(([, sets]) => sets)
      : [];
    return { exerciseId, recentSets };
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getTodayWorkoutContext(
  userId: string
): Promise<WorkoutContext> {
  if (!userId || typeof userId !== 'string') {
    throw new Error('getTodayWorkoutContext requires a non-empty userId');
  }

  const dayName = getLocalDayName();
  const mondayYMD = getLocalMondayYMD();
  const lookupDay = dayName;

  if (__DEV__) {
    console.log('[getWorkoutContext] userId=', userId.slice(0, 8) + '...', 'dayName=', dayName, 'lookupDay=', lookupDay, 'mondayYMD=', mondayYMD);
  }

  if (!supabase) {
    return {
      userId,
      fetchedAt: new Date().toISOString(),
      trainingSettings: null,
      todayPlan: null,
      exerciseHistory: null,
      weeklyVolume: [],
      tmlsnProtocolSchedule: undefined,
    };
  }

  // Parallel: training_settings + today's schedule + weekly volume + history summary
  const [settingsRes, scheduleRes, volumeRes, historySummary] = await Promise.all([
    supabase
      .from('training_settings')
      .select('volume_framework, schedule_mode, current_week')
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('workout_schedule')
      .select('day_of_week, workout_type, exercise_ids, is_rest_day')
      .eq('user_id', userId)
      .eq('day_of_week', lookupDay)
      .maybeSingle(),

    supabase
      .from('weekly_volume_summary')
      .select('muscle_group, week_start, sets_done, mev, mav, mrv')
      .eq('user_id', userId)
      .eq('week_start', mondayYMD),

    getHistorySummary(userId),
  ]);


  // Debug: if schedule/settings null with no error, confirm rows exist
  if (__DEV__ && !settingsRes.error && !scheduleRes.error && (!settingsRes.data || !scheduleRes.data)) {
    const [tsCount, wsCount] = await Promise.all([
      supabase.from('training_settings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('workout_schedule').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ]);
    console.log('[getWorkoutContext] debug: training_settings count=', tsCount.count, 'tsError=', tsCount.error);
    console.log('[getWorkoutContext] debug: workout_schedule count=', wsCount.count, 'wsError=', wsCount.error);
  }

  // Map training settings (fallback to user_settings when training_settings table is empty)
  let trainingSettings: TrainingSettings | null = null;
  if (settingsRes.data) {
    const r = settingsRes.data;
    trainingSettings = {
      volumeFramework: r.volume_framework as TrainingSettings['volumeFramework'],
      scheduleMode: r.schedule_mode ?? null,
      currentWeek: r.current_week,
    };
  } else {
    try {
      const userSettings = await supabaseStorage.supabaseGetUserSettings(userId);
      const t = userSettings.training;
      if (t) {
        trainingSettings = {
          volumeFramework: 'builder' as const,
          scheduleMode: t.scheduleMode ?? null,
          currentWeek: 1,
        };
      }
    } catch {
      // ignore
    }
  }

  const isTmlsnProtocol =
    trainingSettings?.scheduleMode === 'tmlsn' ||
    trainingSettings?.volumeFramework === 'tmlsn_protocol';

  const allExerciseHistory = isTmlsnProtocol && supabase
    ? await fetchAllTmlsnExerciseHistory(userId, supabase)
    : undefined;

  if (__DEV__) {
    if (settingsRes.error) console.warn('[getWorkoutContext] training_settings error:', settingsRes.error);
    if (scheduleRes.error) console.warn('[getWorkoutContext] workout_schedule error:', scheduleRes.error);
    if (volumeRes.error) console.warn('[getWorkoutContext] weekly_volume_summary error:', volumeRes.error);
    const scheduleRow = scheduleRes.data ? 'YES' : 'NO';
    console.log('[getWorkoutContext] dayName=', dayName, 'scheduleRow=', scheduleRow, 'isTmlsnProtocol=', isTmlsnProtocol);
  }

  // Map weekly volume
  const weeklyVolume: VolumeStatus[] = (volumeRes.data ?? []).map((row) => ({
    muscleGroup: row.muscle_group ?? '',
    weekStart: row.week_start ?? '',
    setsDone: Number(row.sets_done ?? 0),
    mev: row.mev ?? null,
    mav: row.mav ?? null,
    mrv: row.mrv ?? null,
  }));

  // No schedule row from DB — use TMLSN fallback when on TMLSN protocol
  const rawSchedule = scheduleRes.data;
  if (!rawSchedule) {
    if (isTmlsnProtocol) {
      if (__DEV__) {
        console.log('[getWorkoutContext] falling back to TMLSN_PROTOCOL_SCHEDULE for', lookupDay);
      }
      const entry = TMLSN_PROTOCOL_SCHEDULE.find((e) => e.day === lookupDay);
      const workoutType = entry?.workoutType ?? null;
      const isRestDay = entry?.isRestDay ?? true;

      let exerciseIds: string[] = [];
      let exerciseNames: string[] = [];
      if (!isRestDay && workoutType) {
        const protocolDay = workoutTypeToProtocolDay(workoutType);
        if (protocolDay) {
          const exercises = getDefaultTmlsnExercises(protocolDay);
          exerciseIds = exercises.map((e) => e.id);
          exerciseNames = exercises.map((e) => e.name);
        }
      }

      const todayPlan: TodayPlan = {
        dayOfWeek: lookupDay,
        workoutType,
        exerciseIds,
        exerciseNames,
        isRestDay,
      };

      if (__DEV__) {
        console.log('[getWorkoutContext] dayName=', lookupDay, 'workoutType=', workoutType, 'exerciseIds count=', exerciseIds.length);
      }

      if (isRestDay || exerciseIds.length === 0) {
        return {
          userId,
          fetchedAt: new Date().toISOString(),
          trainingSettings,
          todayPlan,
          exerciseHistory: null,
          allExerciseHistory,
          weeklyVolume,
          tmlsnProtocolSchedule: TMLSN_PROTOCOL_SCHEDULE,
          recentSessions: historySummary.recentSessions,
          exerciseTrends: historySummary.exerciseTrends,
          adherence: historySummary.adherence,
        };
      }

      const [exerciseHistory, userSettings] = await Promise.all([
        fetchExerciseHistoryFromSessions(userId, exerciseIds),
        supabaseStorage.supabaseGetUserSettings(userId),
      ]);
      const weightUnit = (userSettings.weightUnit ?? 'lb') as 'kg' | 'lb';
      const todayExerciseDetails = await buildTodayExerciseDetails(userId, todayPlan, weightUnit);

      return {
        userId,
        fetchedAt: new Date().toISOString(),
        trainingSettings,
        todayPlan,
        exerciseHistory,
        allExerciseHistory,
        weeklyVolume,
        tmlsnProtocolSchedule: TMLSN_PROTOCOL_SCHEDULE,
        recentSessions: historySummary.recentSessions,
        exerciseTrends: historySummary.exerciseTrends,
        adherence: historySummary.adherence,
        weightUnit,
        todayExerciseDetails,
      };
    }
    return {
      userId,
      fetchedAt: new Date().toISOString(),
      trainingSettings,
      todayPlan: null,
      exerciseHistory: null,
      weeklyVolume,
      tmlsnProtocolSchedule: undefined,
      recentSessions: historySummary.recentSessions,
      exerciseTrends: historySummary.exerciseTrends,
      adherence: historySummary.adherence,
    };
  }

  const rawIds = (rawSchedule.exercise_ids as string[]) ?? [];
  const todayPlan: TodayPlan = {
    dayOfWeek: rawSchedule.day_of_week,
    workoutType: rawSchedule.workout_type ?? null,
    exerciseIds: rawIds,
    exerciseNames: rawIds.map((id) => uuidToExerciseName(id)),
    isRestDay: rawSchedule.is_rest_day ?? false,
  };

  if (todayPlan.isRestDay || todayPlan.exerciseIds.length === 0) {
    return {
      userId,
      fetchedAt: new Date().toISOString(),
      trainingSettings,
      todayPlan,
      exerciseHistory: null,
      allExerciseHistory,
      weeklyVolume,
      tmlsnProtocolSchedule: isTmlsnProtocol ? TMLSN_PROTOCOL_SCHEDULE : undefined,
      recentSessions: historySummary.recentSessions,
      exerciseTrends: historySummary.exerciseTrends,
      adherence: historySummary.adherence,
    };
  }

  const [exerciseHistory, userSettings] = await Promise.all([
    fetchExerciseHistoryFromSessions(userId, todayPlan.exerciseIds),
    supabaseStorage.supabaseGetUserSettings(userId),
  ]);
  const weightUnit = (userSettings.weightUnit ?? 'lb') as 'kg' | 'lb';
  const todayExerciseDetails = await buildTodayExerciseDetails(userId, todayPlan, weightUnit);

  return {
    userId,
    fetchedAt: new Date().toISOString(),
    trainingSettings,
    todayPlan,
    exerciseHistory,
    allExerciseHistory,
    weeklyVolume,
    tmlsnProtocolSchedule: isTmlsnProtocol ? TMLSN_PROTOCOL_SCHEDULE : undefined,
    recentSessions: historySummary.recentSessions,
    exerciseTrends: historySummary.exerciseTrends,
    adherence: historySummary.adherence,
    weightUnit,
    todayExerciseDetails,
  };
}

