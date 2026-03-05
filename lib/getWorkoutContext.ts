import { supabase } from '@/lib/supabase';

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

export interface TodayPlan {
  dayOfWeek: string;
  workoutType: string | null;
  exerciseIds: string[];
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
  weeklyVolume: VolumeStatus[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

type DayName = (typeof DAY_NAMES)[number];

function getTodayName(): DayName {
  return DAY_NAMES[new Date().getDay()];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getTodayWorkoutContext(
  userId: string
): Promise<WorkoutContext> {
  if (!supabase) {
    return {
      userId,
      fetchedAt: new Date().toISOString(),
      trainingSettings: null,
      todayPlan: null,
      exerciseHistory: null,
      weeklyVolume: [],
    };
  }

  const todayName = getTodayName();

  // Parallel: training_settings + today's schedule + weekly volume
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
      .eq('day_of_week', todayName)
      .maybeSingle(),

    supabase
      .from('weekly_volume_summary')
      .select('muscle_group, week_start, sets_done, mev, mav, mrv')
      .eq('user_id', userId)
      .eq(
        'week_start',
        // ISO week start = most recent Monday
        (() => {
          const now = new Date();
          const day = now.getDay(); // 0 = Sun
          const diff = day === 0 ? -6 : 1 - day;
          const monday = new Date(now);
          monday.setDate(now.getDate() + diff);
          return monday.toISOString().slice(0, 10);
        })()
      ),
  ]);

  // Map training settings
  const rawSettings = settingsRes.data;
  const trainingSettings: TrainingSettings | null = rawSettings
    ? {
        volumeFramework: rawSettings.volume_framework as TrainingSettings['volumeFramework'],
        scheduleMode: rawSettings.schedule_mode ?? null,
        currentWeek: rawSettings.current_week,
      }
    : null;

  // Map weekly volume
  const weeklyVolume: VolumeStatus[] = (volumeRes.data ?? []).map((row) => ({
    muscleGroup: row.muscle_group ?? '',
    weekStart: row.week_start ?? '',
    setsDone: Number(row.sets_done ?? 0),
    mev: row.mev ?? null,
    mav: row.mav ?? null,
    mrv: row.mrv ?? null,
  }));

  // No schedule or rest day — skip exercise history
  const rawSchedule = scheduleRes.data;
  if (!rawSchedule) {
    return {
      userId,
      fetchedAt: new Date().toISOString(),
      trainingSettings,
      todayPlan: null,
      exerciseHistory: null,
      weeklyVolume,
    };
  }

  const todayPlan: TodayPlan = {
    dayOfWeek: rawSchedule.day_of_week,
    workoutType: rawSchedule.workout_type ?? null,
    exerciseIds: (rawSchedule.exercise_ids as string[]) ?? [],
    isRestDay: rawSchedule.is_rest_day ?? false,
  };

  if (todayPlan.isRestDay || todayPlan.exerciseIds.length === 0) {
    return {
      userId,
      fetchedAt: new Date().toISOString(),
      trainingSettings,
      todayPlan,
      exerciseHistory: null,
      weeklyVolume,
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
    weeklyVolume,
  };
}
