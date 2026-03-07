import { supabase } from '@/lib/supabase';
import { getDefaultTmlsnExercises, uuidToExerciseName, workoutTypeToProtocolDay, toExerciseUuid, type ProtocolDay, type TmlsnExercise } from '@/lib/getTmlsnTemplate';
import { getHistorySummary } from '@/lib/getHistorySummary';
import { getLocalDayName, getLocalMondayYMD } from '@/lib/time';
import * as supabaseStorage from '@/utils/supabaseStorage';
import { resolveExerciseDbIdFromName } from '@/utils/workoutMuscles';
import { toDisplayWeight, formatWeightDisplay } from '@/utils/units';
import { KG_PER_LB, LB_PER_KG } from '@/utils/units';
import { resolveRepRangesForExercises, type ResolveRepRangeInputFull } from '@/lib/progression/resolveRepRange';
import { decideNextPrescription } from '@/lib/progression/decideNextPrescription';
import { TMLSN_SPLITS } from '@/constants/workoutSplits';

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

/** Human-readable action for JARVIS prompts. Never leak enum strings. */
export type PrescriptionActionPhrase = 'build reps' | 'increase weight' | 'deload';

/** Basis for the prescription (from last session analysis). */
export interface PrescriptionBasedOn {
  lastSessionDate: string | null;
  workingSetsAnalyzed: number;
  maxRpe: number | null;
  hitTopRange: boolean;
}

/** Per-exercise details for JARVIS: exact computed prescription from canonical engine. */
export interface TodayExerciseDetail {
  exerciseName: string;
  ghostWeight: string | null;
  ghostReps: string | null;
  repRangeLow: number;
  repRangeHigh: number;
  /** Increment in kg (for engine). */
  smallestIncrementKg: number;
  /** Increment in user's display unit (e.g. "2.5 kg" or "5.5 lb") */
  incrementDisplay: string;
  /** Human phrase: "build reps" | "increase weight" | "deload" — never add_reps/add_load/reduce_load */
  action: PrescriptionActionPhrase | null;
  reason: string | null;
  basedOn: PrescriptionBasedOn | null;
  /** Legacy; prefer action. Kept for backwards compat. */
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
  /** Extended fields for JARVIS coaching */
  scheduleMode?: string | null;
  archetype?: string;
  volumeFramework?: string;
  todaySessionLabel?: string;
  trainedToday?: boolean;
  lastSession?: string | null;
  totalKcal?: number;
  carbsG?: number;
  proteinG?: number;
  carbsLow?: boolean;
  hasNutritionData?: boolean;
  recentSessionCount?: number;
  lastSessionDate?: string | null;
  coachingSignal?: 'empty' | 'pre_workout_carbs_low' | 'post_workout_carbs_low' | 'session_complete' | 'session_upcoming' | 'neutral';
  hasEnoughDataForCoaching?: boolean;
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

function actionToPhrase(action: 'deload' | 'add_weight' | 'build_reps'): PrescriptionActionPhrase {
  return action === 'deload' ? 'deload' : action === 'add_weight' ? 'increase weight' : 'build reps';
}

/** Build per-exercise details from canonical progression engine. Single source of truth for JARVIS. */
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

  const split = TMLSN_SPLITS.find((s) => s.name === (todayPlan.workoutType ?? ''));

  const resolveItems: ResolveRepRangeInputFull[] = todayPlan.exerciseIds.map((exerciseId, i) => {
    const exerciseName = todayPlan.exerciseNames?.[i] ?? uuidToExerciseName(exerciseId) ?? 'Unknown';
    const splitEx = split?.exercises.find((e) => e.name.toLowerCase() === exerciseName.toLowerCase());
    let historyRepRangeLow: number | undefined;
    let historyRepRangeHigh: number | undefined;
    let historySmallestIncrement: number | undefined;

    for (const session of sortedSessions) {
      const matchEx = session.exercises?.find(
        (e) => toCanonicalExUuid(e.exerciseDbId, e.name) === exerciseId
      );
      if (matchEx) {
        historyRepRangeLow = matchEx.repRangeLow ?? undefined;
        historyRepRangeHigh = matchEx.repRangeHigh ?? undefined;
        historySmallestIncrement = matchEx.smallestIncrement ?? undefined;
        break;
      }
    }

    return {
      exerciseId,
      splitTargetReps: splitEx?.targetReps,
      historyRepRangeLow,
      historyRepRangeHigh,
      historySmallestIncrement,
    };
  });

  const resolved = await resolveRepRangesForExercises(resolveItems);

  return todayPlan.exerciseIds.map((exerciseId, i) => {
    const exerciseName = todayPlan.exerciseNames?.[i] ?? uuidToExerciseName(exerciseId) ?? 'Unknown';
    const r = resolved.get(exerciseId) ?? { repRangeLow: 8, repRangeHigh: 12, smallestIncrement: 2.5 };
    const repRangeLow = r.repRangeLow;
    const repRangeHigh = r.repRangeHigh;
    const incrementKg = r.smallestIncrement;
    const incrementLb = Math.round(incrementKg * LB_PER_KG * 100) / 100;
    const incrementDisplay = weightUnit === 'kg' ? `${incrementKg} kg` : `${incrementLb} lb`;

    let ghostWeight: string | null = null;
    let ghostReps: string | null = null;
    let action: PrescriptionActionPhrase | null = null;
    let reason: string | null = null;
    let basedOn: PrescriptionBasedOn | null = null;
    let goal: string | null = null;

    // Find last session with this exercise and run canonical engine
    for (const session of sortedSessions) {
      const matchEx = session.exercises?.find(
        (e) => toCanonicalExUuid(e.exerciseDbId, e.name) === exerciseId
      );
      if (!matchEx) continue;

      const doneSets = (matchEx.sets ?? []).filter((s) => (s.weight ?? 0) > 0 && (s.reps ?? 0) > 0);
      if (doneSets.length === 0) continue;

      const sessionDate = session.date?.slice(0, 10) ?? '';
      const workingSets = doneSets.map((s) => ({
        weight: s.weight ?? 0,
        reps: s.reps ?? 0,
        rpe: s.rpe ?? null,
        completed: true,
      }));

      const decision = decideNextPrescription({
        sets: workingSets,
        repRangeLow,
        repRangeHigh,
        // Context preview — real band state lives in Supabase exercise_progress_state.
        // These defaults keep the ghost weight accurate for coaching while avoiding
        // a runtime crash from missing required fields.
        overloadCategory: 'compound_small',
        currentBand: 'easy',
        consecutiveSuccess: 0,
        consecutiveFailure: 0,
        isCalibrating: false,
        isDeloadWeek: false,
        blitzMode: false,
      });

      if (decision) {
        ghostWeight = formatWeightDisplay(toDisplayWeight(decision.nextWeightLb, weightUnit), weightUnit);
        ghostReps = String(decision.nextRepTarget);
        action = actionToPhrase(decision.action as 'deload' | 'add_weight' | 'build_reps');
        reason = decision.reason;
        goal = decision.goal;
        const rpeVals = workingSets.map((s) => s.rpe).filter((r): r is number => r != null && r > 0);
        basedOn = {
          lastSessionDate: sessionDate,
          workingSetsAnalyzed: workingSets.length,
          maxRpe: rpeVals.length > 0 ? Math.max(...rpeVals) : null,
          hitTopRange: decision.debug.hitThreshold,
        };
      } else {
        const last = doneSets[doneSets.length - 1];
        ghostWeight = formatWeightDisplay(toDisplayWeight(last.weight, weightUnit), weightUnit);
        ghostReps = String(last.reps);
      }
      break;
    }

    // Fallback when no history: use DB prescription
    if (!ghostWeight || !ghostReps) {
      const prescription = prescriptions[exerciseId];
      if (prescription) {
        ghostWeight = formatWeightDisplay(toDisplayWeight(prescription.nextWeight, weightUnit), weightUnit);
        ghostReps = String(prescription.goal === 'add_load' ? repRangeLow : repRangeHigh);
        goal = prescription.goal;
        action = prescription.goal === 'add_load' ? 'increase weight' : prescription.goal === 'reduce_load' ? 'deload' : 'build reps';
      }
    }

    return {
      exerciseName,
      ghostWeight,
      ghostReps,
      repRangeLow,
      repRangeHigh,
      smallestIncrementKg: incrementKg,
      incrementDisplay,
      action,
      reason,
      basedOn,
      goal,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodaySessionLabel(
  scheduleMode: string | null | undefined,
  volumeFramework: string | undefined,
  todayPlan: TodayPlan | null,
  schedule: readonly { day: string; workoutType: string | null; isRestDay: boolean }[]
): string {
  const dayName = getLocalDayName();
  const entry = Array.isArray(schedule) ? schedule.find((e) => e?.day === dayName) : null;

  if (scheduleMode === 'tmlsn' || scheduleMode === 'tmlsn_protocol' || volumeFramework === 'tmlsn_protocol') {
    if (entry?.isRestDay) return 'Rest Day';
    return entry?.workoutType ?? todayPlan?.workoutType ?? 'Today';
  }
  if (scheduleMode === 'builder' && entry) {
    if (entry.isRestDay) return 'Rest Day';
    return entry.workoutType ?? todayPlan?.workoutType ?? 'Today';
  }
  return todayPlan?.workoutType ?? 'Today';
}

function buildDegradedContext(userId: string): WorkoutContext {
  return {
    userId,
    fetchedAt: new Date().toISOString(),
    trainingSettings: null,
    todayPlan: null,
    exerciseHistory: null,
    weeklyVolume: [],
    tmlsnProtocolSchedule: undefined,
    recentSessionCount: 0,
    lastSessionDate: null,
    coachingSignal: 'empty',
    hasEnoughDataForCoaching: false,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getTodayWorkoutContext(
  userId: string
): Promise<WorkoutContext> {
  const effectiveUserId = userId && typeof userId === 'string' ? userId : '';
  const dayName = getLocalDayName();
  const mondayYMD = getLocalMondayYMD();
  const lookupDay = dayName;

  if (__DEV__ && effectiveUserId) {
    console.log('[getWorkoutContext] userId=', effectiveUserId.slice(0, 8) + '...', 'dayName=', dayName, 'lookupDay=', lookupDay, 'mondayYMD=', mondayYMD);
  }

  if (!effectiveUserId) {
    return buildDegradedContext(effectiveUserId || 'anonymous');
  }

  if (!supabase) {
    return buildDegradedContext(effectiveUserId);
  }

  try {
    // Parallel: training_settings + today's schedule + weekly volume (history fetched after we have trainingSettings)
    const [settingsRes, scheduleRes, volumeRes] = await Promise.all([
      supabase
        .from('training_settings')
        .select('volume_framework, schedule_mode, current_week')
        .eq('user_id', effectiveUserId)
        .maybeSingle(),

      supabase
        .from('workout_schedule')
        .select('day_of_week, workout_type, exercise_ids, is_rest_day')
        .eq('user_id', effectiveUserId)
        .eq('day_of_week', lookupDay)
        .maybeSingle(),

      supabase
        .from('weekly_volume_summary')
        .select('muscle_group, week_start, sets_done, mev, mav, mrv')
        .eq('user_id', effectiveUserId)
        .eq('week_start', mondayYMD),
    ]);

    // Map training settings first (needed for getHistorySummary filter)
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
        const userSettings = await supabaseStorage.supabaseGetUserSettings(effectiveUserId);
        const t = userSettings.training;
        if (t) {
          trainingSettings = {
            volumeFramework: (t.volumeFramework as TrainingSettings['volumeFramework']) ?? 'builder',
            scheduleMode: t.scheduleMode ?? null,
            currentWeek: 1,
          };
        }
      } catch {
        // ignore
      }
    }

    // History summary with schedule_mode filter applied inside (4s timeout, never throws)
    const historySummary = await getHistorySummary(effectiveUserId, trainingSettings);


    // Debug: if schedule/settings null with no error, confirm rows exist
    if (__DEV__ && !settingsRes.error && !scheduleRes.error && (!settingsRes.data || !scheduleRes.data)) {
      const [tsCount, wsCount] = await Promise.all([
        supabase.from('training_settings').select('id', { count: 'exact', head: true }).eq('user_id', effectiveUserId),
        supabase.from('workout_schedule').select('id', { count: 'exact', head: true }).eq('user_id', effectiveUserId),
      ]);
      console.log('[getWorkoutContext] debug: training_settings count=', tsCount.count, 'tsError=', tsCount.error);
      console.log('[getWorkoutContext] debug: workout_schedule count=', wsCount.count, 'wsError=', wsCount.error);
    }

    const isTmlsnProtocol =
    trainingSettings?.scheduleMode === 'tmlsn' ||
    trainingSettings?.scheduleMode === 'tmlsn_protocol' ||
    trainingSettings?.volumeFramework === 'tmlsn_protocol';

    const allExerciseHistory = isTmlsnProtocol && supabase
      ? await fetchAllTmlsnExerciseHistory(effectiveUserId, supabase)
      : undefined;

    if (__DEV__) {
      if (settingsRes.error) console.warn('[getWorkoutContext] training_settings error:', settingsRes.error);
      if (scheduleRes.error) console.warn('[getWorkoutContext] workout_schedule error:', scheduleRes.error);
      if (volumeRes.error) console.warn('[getWorkoutContext] weekly_volume_summary error:', volumeRes.error);
      const scheduleRow = scheduleRes.data ? 'YES' : 'NO';
      console.log('[getWorkoutContext] dayName=', dayName, 'scheduleRow=', scheduleRow, 'isTmlsnProtocol=', isTmlsnProtocol);
    }

    // Map weekly volume
    const weeklyVolume: VolumeStatus[] = (volumeRes.data ?? []).map((row: { muscle_group?: string; week_start?: string; sets_done?: number; mev?: number; mav?: number; mrv?: number }) => ({
      muscleGroup: row.muscle_group ?? '',
      weekStart: row.week_start ?? '',
      setsDone: Number(row.sets_done ?? 0),
      mev: row.mev ?? null,
      mav: row.mav ?? null,
      mrv: row.mrv ?? null,
    }));

    const todayYMD = new Date().toISOString().slice(0, 10);
    const trainedToday = (historySummary.recentSessions ?? []).some((s) => s.sessionDate === todayYMD);
    const lastSession = historySummary.lastSessionDate ?? historySummary.adherence?.lastWorkoutDate ?? null;

    const extendWithCoaching = (ctx: WorkoutContext, plan: TodayPlan | null): WorkoutContext => {
      const hasSession = (plan?.exerciseIds?.length ?? 0) > 0 && !plan?.isRestDay;
      let coachingSignal: WorkoutContext['coachingSignal'] = 'neutral';
      if (!plan && (historySummary.recentSessionCount ?? 0) === 0) coachingSignal = 'empty';
      else if (hasSession) coachingSignal = 'session_upcoming';
      else if (trainedToday) coachingSignal = 'session_complete';
      return {
        ...ctx,
        scheduleMode: trainingSettings?.scheduleMode ?? null,
        archetype: (trainingSettings as { archetype?: string })?.archetype,
        volumeFramework: trainingSettings?.volumeFramework,
        todaySessionLabel: getTodaySessionLabel(
          trainingSettings?.scheduleMode,
          trainingSettings?.volumeFramework,
          plan,
          TMLSN_PROTOCOL_SCHEDULE
        ),
        trainedToday,
        lastSession: lastSession ?? undefined,
        totalKcal: 0,
        carbsG: 0,
        proteinG: 0,
        carbsLow: false,
        hasNutritionData: false,
        recentSessionCount: historySummary.recentSessionCount ?? 0,
        lastSessionDate: lastSession ?? undefined,
        coachingSignal,
        hasEnoughDataForCoaching: (historySummary.recentSessionCount ?? 0) > 0,
      };
    };

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
          return extendWithCoaching({
            userId: effectiveUserId,
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
          }, todayPlan);
        }

        const [exerciseHistory, userSettings] = await Promise.all([
          fetchExerciseHistoryFromSessions(effectiveUserId, exerciseIds),
          supabaseStorage.supabaseGetUserSettings(effectiveUserId),
        ]);
        const weightUnit = (userSettings.weightUnit ?? 'lb') as 'kg' | 'lb';
        const todayExerciseDetails = await buildTodayExerciseDetails(effectiveUserId, todayPlan, weightUnit);

        return extendWithCoaching({
          userId: effectiveUserId,
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
        }, todayPlan);
      }
      // ── Fallback: derive today's plan from user_settings.data.training.weekPlan ──
      // Used when workout_schedule table doesn't exist (migration 008 not yet applied).
      const DAY_INDEX: Record<string, number> = {
        Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
        Friday: 4, Saturday: 5, Sunday: 6,
      };
      try {
        const us = await supabaseStorage.supabaseGetUserSettings(effectiveUserId);
        const plan = (us.training?.weekPlan ?? []) as Array<{ sessionName?: string; isRest?: boolean } | null>;
        const dayIdx = DAY_INDEX[lookupDay] ?? -1;
        const entry = dayIdx >= 0 ? (plan[dayIdx] ?? null) : null;
        if (entry && (entry.sessionName || entry.isRest)) {
          const sessionName = entry.sessionName ?? null;
          const isRestDay = entry.isRest ?? false;
          let exerciseIds: string[] = [];
          let exerciseNames: string[] = [];
          if (!isRestDay && sessionName) {
            const protocolDay = workoutTypeToProtocolDay(sessionName);
            if (protocolDay) {
              const exercises = getDefaultTmlsnExercises(protocolDay);
              exerciseIds = exercises.map((e) => e.id);
              exerciseNames = exercises.map((e) => e.name);
            }
          }
          const todayPlanFromSettings: TodayPlan = {
            dayOfWeek: lookupDay,
            workoutType: sessionName,
            exerciseIds,
            exerciseNames,
            isRestDay,
          };
          if (__DEV__) {
            console.log('[getWorkoutContext] weekPlan fallback: sessionName=', sessionName, 'exerciseIds=', exerciseIds.length);
          }
          const weightUnit = (us.weightUnit ?? 'lb') as 'kg' | 'lb';
          const [exerciseHistory, todayExerciseDetails] = await Promise.all([
            exerciseIds.length > 0
              ? fetchExerciseHistoryFromSessions(effectiveUserId, exerciseIds)
              : Promise.resolve(null),
            exerciseIds.length > 0
              ? buildTodayExerciseDetails(effectiveUserId, todayPlanFromSettings, weightUnit)
              : Promise.resolve([] as TodayExerciseDetail[]),
          ]);
          return extendWithCoaching({
            userId: effectiveUserId,
            fetchedAt: new Date().toISOString(),
            trainingSettings,
            todayPlan: todayPlanFromSettings,
            exerciseHistory,
            weeklyVolume,
            tmlsnProtocolSchedule: undefined,
            recentSessions: historySummary.recentSessions,
            exerciseTrends: historySummary.exerciseTrends,
            adherence: historySummary.adherence,
            weightUnit,
            todayExerciseDetails: todayExerciseDetails.length > 0 ? todayExerciseDetails : undefined,
          }, todayPlanFromSettings);
        }
      } catch { /* ignore, fall through to no-plan */ }

      return extendWithCoaching({
        userId: effectiveUserId,
        fetchedAt: new Date().toISOString(),
        trainingSettings,
        todayPlan: null,
        exerciseHistory: null,
        weeklyVolume,
        tmlsnProtocolSchedule: undefined,
        recentSessions: historySummary.recentSessions,
        exerciseTrends: historySummary.exerciseTrends,
        adherence: historySummary.adherence,
      }, null);
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
      return extendWithCoaching({
        userId: effectiveUserId,
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
      }, todayPlan);
    }

    const [exerciseHistory, userSettings] = await Promise.all([
      fetchExerciseHistoryFromSessions(effectiveUserId, todayPlan.exerciseIds),
      supabaseStorage.supabaseGetUserSettings(effectiveUserId),
    ]);
    const weightUnit = (userSettings.weightUnit ?? 'lb') as 'kg' | 'lb';
    const todayExerciseDetails = await buildTodayExerciseDetails(effectiveUserId, todayPlan, weightUnit);

    return extendWithCoaching({
      userId: effectiveUserId,
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
    }, todayPlan);
  } catch (e) {
    if (__DEV__) console.warn('[getWorkoutContext] error:', e);
    return buildDegradedContext(effectiveUserId || 'anonymous');
  }
}

