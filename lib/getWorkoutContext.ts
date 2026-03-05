import { supabase } from '@/lib/supabase';
import { getDefaultTmlsnExercises, uuidToExerciseName, workoutTypeToProtocolDay, type ProtocolDay, type TmlsnExercise } from '@/lib/getTmlsnTemplate';
import { getLocalDayName, getLocalMondayYMD } from '@/lib/time';
import * as supabaseStorage from '@/utils/supabaseStorage';

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
}

// ─── All-exercise history fetch ───────────────────────────────────────────────

async function fetchAllTmlsnExerciseHistory(
  userId: string,
  sb: NonNullable<typeof supabase>
): Promise<AllExerciseHistory> {
  const days: ProtocolDay[] = ['Upper A', 'Lower A', 'Upper B', 'Lower B'];
  const exercisesByDay: Partial<Record<ProtocolDay, TmlsnExercise[]>> = {};
  const idSet = new Set<string>();

  for (const day of days) {
    const exs = getDefaultTmlsnExercises(day);
    exercisesByDay[day] = exs;
    for (const e of exs) idSet.add(e.id);
  }

  const uniqueIds = [...idSet];
  const { data } = await sb
    .from('workout_logs')
    .select('exercise_id, session_date, weight, reps, rpe, target_reps, target_weight')
    .eq('user_id', userId)
    .in('exercise_id', uniqueIds)
    .order('session_date', { ascending: false })
    .limit(600); // ~20 exercises × 3 sessions × 10 sets

  // Group rows by exercise_id -> session_date
  const byExercise = new Map<string, Map<string, ScheduledSet[]>>();
  for (const row of (data ?? [])) {
    const exId = row.exercise_id as string;
    const date = row.session_date as string;
    if (!byExercise.has(exId)) byExercise.set(exId, new Map());
    const dateMap = byExercise.get(exId)!;
    if (!dateMap.has(date)) dateMap.set(date, []);
    dateMap.get(date)!.push({
      weight: row.weight ?? null,
      reps: row.reps ?? null,
      rpe: row.rpe ?? null,
      targetReps: row.target_reps ?? null,
      targetWeight: row.target_weight ?? null,
      sessionDate: date,
    });
  }

  const result: AllExerciseHistory = {};
  for (const day of days) {
    const exs = exercisesByDay[day] ?? [];
    result[day] = exs.map((ex) => {
      const dateMap = byExercise.get(ex.id);
      const recentSets = dateMap
        ? Array.from(dateMap.values()).slice(0, 3).flat()
        : [];
      return { exerciseId: ex.id, exerciseName: ex.name, recentSets };
    });
  }

  return result;
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

  // Parallel: training_settings + today's schedule + weekly volume (all filtered by user_id)
  const [settingsRes, scheduleRes, volumeRes] = await Promise.all([
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
        };
      }

      // Fetch exercise history for template exercises
      const historyResults = await Promise.all(
        exerciseIds.map((exerciseId) =>
          supabase!
            .from('workout_logs')
            .select('session_date, weight, reps, rpe, target_reps, target_weight')
            .eq('user_id', userId)
            .eq('exercise_id', exerciseId)
            .order('session_date', { ascending: false })
            .limit(3 * 10)
        )
      );

      const exerciseHistory: ExerciseHistory[] = exerciseIds.map((exerciseId, idx) => {
        const rows = historyResults[idx].data ?? [];
        const dateMap = new Map<string, ScheduledSet[]>();
        for (const row of rows) {
          const date = row.session_date as string;
          if (!dateMap.has(date)) dateMap.set(date, []);
          dateMap.get(date)!.push({
            weight: row.weight ?? null,
            reps: row.reps ?? null,
            rpe: row.rpe ?? null,
            targetReps: row.target_reps ?? null,
            targetWeight: row.target_weight ?? null,
            sessionDate: date,
          });
        }
        const recentSets = Array.from(dateMap.values()).slice(0, 3).flat();
        return { exerciseId, recentSets };
      });

      return {
        userId,
        fetchedAt: new Date().toISOString(),
        trainingSettings,
        todayPlan,
        exerciseHistory,
        allExerciseHistory,
        weeklyVolume,
        tmlsnProtocolSchedule: TMLSN_PROTOCOL_SCHEDULE,
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
    };
  }

  // Fetch last 3 sessions for each exercise in parallel
  const historyResults = await Promise.all(
    todayPlan.exerciseIds.map((exerciseId) =>
      supabase!
        .from('workout_logs')
        .select('session_date, weight, reps, rpe, target_reps, target_weight')
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .order('session_date', { ascending: false })
        .limit(3 * 10) // up to 10 sets per session × 3 sessions
    )
  );

  const exerciseHistory: ExerciseHistory[] = todayPlan.exerciseIds.map(
    (exerciseId, idx) => {
      const rows = historyResults[idx].data ?? [];

      // Group by session_date, keep newest 3 distinct dates
      const dateMap = new Map<string, ScheduledSet[]>();
      for (const row of rows) {
        const date = row.session_date as string;
        if (!dateMap.has(date)) dateMap.set(date, []);
        dateMap.get(date)!.push({
          weight: row.weight ?? null,
          reps: row.reps ?? null,
          rpe: row.rpe ?? null,
          targetReps: row.target_reps ?? null,
          targetWeight: row.target_weight ?? null,
          sessionDate: date,
        });
      }

      // Newest first, max 3 sessions
      const recentSets = Array.from(dateMap.values())
        .slice(0, 3)
        .flat();

      return { exerciseId, recentSets };
    }
  );

  return {
    userId,
    fetchedAt: new Date().toISOString(),
    trainingSettings,
    todayPlan,
    exerciseHistory,
    allExerciseHistory,
    weeklyVolume,
    tmlsnProtocolSchedule: isTmlsnProtocol ? TMLSN_PROTOCOL_SCHEDULE : undefined,
  };
}

