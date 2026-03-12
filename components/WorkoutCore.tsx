/**
 * WorkoutCore — shared workout overlay logic extracted from workout screens.
 * Renders overlay content only (top bar, summary stats, rest timer, exercise blocks, modals).
 * The wrapper (route) provides the container and route-specific UI.
 */
import React, { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  TextInput,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { TMLSN_SPLITS } from '../constants/workoutSplits';
import {
  getSavedRoutines,
  getUserSettings,
  getWorkoutSessions,
} from '../utils/storage';
import { toDisplayWeight, fromDisplayWeight, toDisplayVolume } from '../utils/units';
import { WorkoutSession, Exercise, Set, WorkoutSplit, SavedRoutine } from '../types';
import { generateId, formatDuration, buildExerciseFromRoutineTemplate } from '../utils/helpers';
import { resolveExerciseDbIdFromName } from '../utils/workoutMuscles';
import { toExerciseUuid } from '../lib/getTmlsnTemplate';
import { getAllExerciseSettings } from '../utils/exerciseSettings';
import { scheduleRestTimerNotification, cancelNotification } from '../utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useButtonSound } from '../hooks/useButtonSound';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { AnimatedFadeInUp } from './AnimatedFadeInUp';
import { Card } from './Card';
import { ExercisePickerModal } from './ExercisePickerModal';
import Slider from '@react-native-community/slider';
import { StickyWorkoutHeader } from './StickyWorkoutHeader';
import ExerciseStatsModal from './ExerciseStatsModal';
import { useExerciseReorder } from './DraggableExerciseList';
import { WorkoutSetTable } from './WorkoutSetTable';
import { buildPrevSetsAndGhost } from '../utils/workoutSetTable';
import { getInvalidCompletedSets } from '../utils/workoutSetValidation';
import { updateToRestTimer, cancelRestTimerActivity } from '../lib/liveActivity';
import { useTheme } from '../context/ThemeContext';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { useAuth } from '../context/AuthContext';
import { shouldTriggerLowRpeWarning } from '../utils/rpe';
import { getTodayWorkoutContext, type TodayExerciseDetail } from '../lib/getWorkoutContext';
import {
  supabaseGetExercisePrescriptions,
  supabaseFetchUserExercises,
  supabaseInsertUserExercise,
  ExercisePrescriptionRow,
  resolveOverloadCategory,
} from '../utils/supabaseStorage';
import type { Exercise as DbExercise, CreateExerciseInput } from '../utils/exerciseDb/types';
import { EXERCISE_MAP, getLoadEntryModeForExercise } from '../utils/exerciseDb/exerciseDatabase';
import { LB_PER_KG } from '../utils/units';
import { getIncrementKg } from '../lib/progression/decideNextPrescription';
import type { DifficultyBand } from '../lib/progression/decideNextPrescription';

// ─── Exports ─────────────────────────────────────────────────────────────────

export const formatRoutineTitle = (name: string) => {
  const lower = name.toLowerCase();
  const words = lower.split(' ');
  const lastWord = words[words.length - 1];
  if (lastWord.length === 1 && /[a-z]/.test(lastWord)) {
    words[words.length - 1] = lastWord.toUpperCase();
  }
  return words.join(' ');
};

function normalizeExerciseName(name: string | undefined | null): string {
  return String(name ?? '').trim().toLowerCase();
}

function getResolvedTargetReps(detail: TodayExerciseDetail | undefined, fallbackReps: number): number {
  const ghostReps = Number.parseInt(detail?.ghostReps ?? '', 10);
  if (Number.isFinite(ghostReps) && ghostReps > 0) {
    return ghostReps;
  }
  if (detail?.repRangeLow && detail.repRangeLow > 0) {
    return detail.repRangeLow;
  }
  return fallbackReps;
}

function getResolvedTargetWeightLb(detail: TodayExerciseDetail | undefined): number | null {
  if (detail?.nextWeightLb != null && Number.isFinite(detail.nextWeightLb) && detail.nextWeightLb >= 0) {
    return detail.nextWeightLb;
  }
  return null;
}

/** Build a fresh WorkoutSession payload for save (from latest state). */
export function buildCompletedWorkoutSession(w: WorkoutSession): WorkoutSession {
  const duration = Math.round(
    (new Date().getTime() - new Date(w.date).getTime()) / 60000
  );
  return {
    id: w.id,
    date: w.date,
    name: w.name,
    exercises: (w.exercises ?? []).map((ex) => ({
      id: ex.id,
      name: ex.name,
      exerciseDbId: ex.exerciseDbId,
      restTimer: ex.restTimer,
      sets: (ex.sets ?? []).filter((s) => s.completed).map((s) => ({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
        rpe: s.rpe ?? undefined,
        notes: s.notes ?? undefined,
      })),
    })),
    duration,
    isComplete: true,
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

export type WorkoutCoreProps = {
  onFinish: (payload: WorkoutSession) => Promise<void>;
  useStickyHeader: boolean;
  enableReorder: boolean;
  enableStatsModal: boolean;
  enableRpeBump: boolean;
  recentSessions: WorkoutSession[];
  /** When enableRpeBump, called when user completes set with a low-effort RPE (for Dynamic Island warning). */
  onRpeWarning?: (rpe: number, exerciseName: string, weightBumpDisplay?: string | null) => void;
  /** Called when weightUnit is loaded (e.g. for DynamicIslandRPEWarning in standalone). */
  onWeightUnitReady?: (weightUnit: 'kg' | 'lb') => void;
  expandOnFocus?: boolean;
  asModal?: boolean;
  initialActiveWorkout?: WorkoutSession | null;
  onCloseModal?: () => void;
};

const STICKY_HEADER_HEIGHT = 105;

export function WorkoutCore({
  onFinish,
  useStickyHeader,
  enableReorder,
  enableStatsModal,
  enableRpeBump,
  recentSessions,
  onRpeWarning,
  onWeightUnitReady,
  expandOnFocus = true,
  asModal = false,
  initialActiveWorkout = null,
  onCloseModal,
}: WorkoutCoreProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const {
    activeWorkout,
    setActiveWorkout,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    minimized,
    minimizeWorkout,
    expandWorkout,
  } = useActiveWorkout();

  const minimizedRef = useRef(minimized);
  useEffect(() => { minimizedRef.current = minimized; }, [minimized]);

  const { startSplitId, startRoutineId, startEmpty } = useLocalSearchParams<{
    startSplitId?: string;
    startRoutineId?: string;
    startEmpty?: string;
  }>();

  useLayoutEffect(() => {
    if (initialActiveWorkout) {
      setActiveWorkout(initialActiveWorkout);
      setCurrentExerciseIndex(0);
    }
  }, [initialActiveWorkout, setActiveWorkout, setCurrentExerciseIndex]);

  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [replaceExerciseIndex, setReplaceExerciseIndex] = useState<number | null>(null);
  const [exerciseMenuIndex, setExerciseMenuIndex] = useState<number | null>(null);
  const [restTimeEditExerciseIndex, setRestTimeEditExerciseIndex] = useState<number | null>(null);
  const [restEditMinutes, setRestEditMinutes] = useState(0);
  const [restEditSeconds, setRestEditSeconds] = useState(0);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [animTrigger, setAnimTrigger] = useState(0);
  const weightBumpDisplayRef = useRef<Record<string, string | null>>({});

  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [restTimerNotificationId, setRestTimerNotificationId] = useState<string | null>(null);
  const [restTimerContext, setRestTimerContext] = useState<{ exerciseName: string; setNumberDisplay: number } | null>(null);

  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const restTimerOpacity = useSharedValue(0);
  const restTimerTranslateY = useSharedValue(-10);
  const rtRow0Opacity = useSharedValue(0);
  const rtRow1Opacity = useSharedValue(0);
  const rtRow2Opacity = useSharedValue(0);
  const rtRow3Opacity = useSharedValue(0);

  const TIMER_ENTER_MS = 200;
  const TIMER_EXIT_MS = 160;
  const TIMER_STAGGER = 55;

  useEffect(() => {
    const shouldShow = restTimerActive && restTimeRemaining > 0;
    if (__DEV__) console.log('[Workout UI] rest timer visible:', shouldShow);
    if (shouldShow) {
      setRestTimerVisible(true);
      restTimerOpacity.value = withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) });
      restTimerTranslateY.value = withTiming(0, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) });
      rtRow0Opacity.value = withDelay(0, withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
      rtRow1Opacity.value = withDelay(TIMER_STAGGER, withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
      rtRow2Opacity.value = withDelay(TIMER_STAGGER * 2, withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
      rtRow3Opacity.value = withDelay(TIMER_STAGGER * 3, withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
    } else {
      restTimerOpacity.value = withTiming(0, { duration: TIMER_EXIT_MS, easing: Easing.in(Easing.cubic) });
      restTimerTranslateY.value = withTiming(-8, { duration: TIMER_EXIT_MS, easing: Easing.in(Easing.cubic) });
      rtRow0Opacity.value = withTiming(0, { duration: TIMER_EXIT_MS });
      rtRow1Opacity.value = withTiming(0, { duration: TIMER_EXIT_MS });
      rtRow2Opacity.value = withTiming(0, { duration: TIMER_EXIT_MS });
      rtRow3Opacity.value = withTiming(0, { duration: TIMER_EXIT_MS });
      const t = setTimeout(() => setRestTimerVisible(false), TIMER_EXIT_MS + 20);
      return () => clearTimeout(t);
    }
  }, [restTimerActive, restTimeRemaining > 0]);

  const restTimerPanelStyle = useAnimatedStyle(() => ({
    opacity: restTimerOpacity.value,
    transform: [{ translateY: restTimerTranslateY.value }],
  }));
  const rtRow0Style = useAnimatedStyle(() => ({ opacity: rtRow0Opacity.value }));
  const rtRow1Style = useAnimatedStyle(() => ({ opacity: rtRow1Opacity.value }));
  const rtRow2Style = useAnimatedStyle(() => ({ opacity: rtRow2Opacity.value }));
  const rtRow3Style = useAnimatedStyle(() => ({ opacity: rtRow3Opacity.value }));

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [commitOutsideTrigger, setCommitOutsideTrigger] = useState(0);
  const [prescriptions, setPrescriptions] = useState<Record<string, ExercisePrescriptionRow>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [showSetNotesModal, setShowSetNotesModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{ exerciseIndex: number; setIndex?: number } | null>(null);
  const [setNotesText, setSetNotesText] = useState('');

  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalTab, setStatsModalTab] = useState<'volume' | 'sets'>('volume');
  const [userExercises, setUserExercises] = useState<DbExercise[]>([]);
  const [userSettings, setUserSettings] = useState<{ dumbbellWeightPreference?: 'per_hand' | 'total' } | null>(null);

  const { playIn, playOut } = useButtonSound();

  useEffect(() => {
    if (showExercisePicker && user?.id) {
      supabaseFetchUserExercises(user.id).then(setUserExercises);
    }
  }, [showExercisePicker, user?.id]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const lastProcessedStartEmpty = useRef(false);
  const lastProcessedSplitId = useRef<string | null>(null);
  const lastProcessedRoutineId = useRef<string | null>(null);
  const activeWorkoutRef = useRef<WorkoutSession | null>(null);
  const workoutScrollRef = useRef<any>(null);
  const restTimerEndRef = useRef<number | null>(null);
  const setTableBlockYRef = useRef<Map<number, number>>(new Map());
  const setTableRowYRef = useRef<Map<string, number>>(new Map());
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);

  const hasActiveRestTimer = useCallback(() => {
    return restTimerEndRef.current !== null && restTimerEndRef.current > Date.now();
  }, []);

  const reorder = useExerciseReorder(
    activeWorkout?.exercises ?? [],
    (newExercises) => {
      if (!activeWorkout) return;
      setActiveWorkout({ ...activeWorkout, exercises: newExercises });
    },
  );

  const noReorder = useMemo(() => ({
    activeIndex: null as number | null,
    onLongPress: () => {},
    moveUp: () => {},
    moveDown: () => {},
    cancel: () => {},
    getCardStyle: () => ({}),
    getDragHandleStyle: () => ({}),
  }), []);

  const reorderHandle = enableReorder ? reorder : noReorder;

  useEffect(() => {
    if (asModal || startEmpty !== '1') {
      if (!asModal) lastProcessedStartEmpty.current = false;
      return;
    }
    if (lastProcessedStartEmpty.current) return;
    lastProcessedStartEmpty.current = true;
    startFreeformWorkout();
    router.setParams({});
  }, [asModal, startEmpty]);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      getUserSettings().then((s) => {
        setWeightUnit(s.weightUnit);
        setUserSettings(s);
        onWeightUnitReady?.(s.weightUnit);
      });
      if (expandOnFocus && activeWorkout && minimizedRef.current) expandWorkout();
    }, [activeWorkout, expandWorkout, expandOnFocus, onWeightUnitReady])
  );

  useEffect(() => { activeWorkoutRef.current = activeWorkout; }, [activeWorkout]);

  useEffect(() => {
    if (startSplitId && startSplitId !== lastProcessedSplitId.current) {
      const split = TMLSN_SPLITS.find((s) => s.id === startSplitId);
      if (split) {
        lastProcessedSplitId.current = startSplitId;
        startWorkoutFromSplit(split);
        router.setParams({});
      }
    }
  }, [startSplitId]);

  useEffect(() => {
    if (startRoutineId && startRoutineId !== lastProcessedRoutineId.current) {
      (async () => {
        const [routines, settings] = await Promise.all([getSavedRoutines(), getUserSettings()]);
        const routine = routines.find((r) => r.id === startRoutineId);
        if (routine) {
          lastProcessedRoutineId.current = startRoutineId;
          const defaultRestTimer = settings?.defaultRestTimer ?? 120;
          startWorkoutFromSavedRoutine(routine, defaultRestTimer);
          router.setParams({});
        }
      })();
    }
  }, [startRoutineId]);

  useEffect(() => {
    if (!activeWorkout || !user) { setPrescriptions({}); return; }
    const canonicalIds = activeWorkout.exercises
      .map((ex) => ex.exerciseDbId ?? ex.name)
      .filter(Boolean) as string[];
    supabaseGetExercisePrescriptions(user.id, canonicalIds).then(setPrescriptions);
  }, [activeWorkout?.id, user?.id]);

  const exerciseProgressionMap = useMemo(() => {
    if (!activeWorkout) return new Map<string, ReturnType<typeof buildPrevSetsAndGhost>>();
    const sessionsForProgression = recentSessions.filter((s) => s.id !== activeWorkout.id);
    return new Map(
      activeWorkout.exercises.map((exercise) => [
        exercise.id,
        buildPrevSetsAndGhost(exercise, prescriptions, sessionsForProgression, weightUnit),
      ])
    );
  }, [activeWorkout?.exercises, prescriptions, recentSessions, weightUnit]);

  useEffect(() => {
    if (!activeWorkout) { setElapsedSeconds(0); return; }
    const startMs = new Date(activeWorkout.date).getTime();
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout?.id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (restTimerActive && restTimeRemaining > 0) {
      interval = setInterval(() => {
        setRestTimeRemaining((prev) => {
          if (prev <= 1) {
            setRestTimerActive(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [restTimerActive, restTimeRemaining]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && restTimerEndRef.current !== null) {
        const remaining = Math.round((restTimerEndRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          restTimerEndRef.current = null;
          setRestTimerActive(false);
          setRestTimerContext(null);
          setRestTimeRemaining(0);
          cancelRestTimerActivity();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          setRestTimeRemaining(remaining);
        }
      }
    });
    return () => sub.remove();
  }, []);

  const startWorkoutFromSplit = async (split: WorkoutSplit) => {
    const [allSettings, todayContext] = await Promise.all([
      getAllExerciseSettings(),
      user?.id ? getTodayWorkoutContext(user.id).catch(() => null) : Promise.resolve(null),
    ]);
    const todayDetailsByName = new Map<string, TodayExerciseDetail>();
    if (
      todayContext?.todayPlan &&
      !todayContext.todayPlan.isRestDay &&
      normalizeExerciseName(todayContext.todayPlan.workoutType) === normalizeExerciseName(split.name)
    ) {
      for (const detail of todayContext.todayExerciseDetails ?? []) {
        todayDetailsByName.set(normalizeExerciseName(detail.exerciseName), detail);
      }
    }
    const exercises: Exercise[] = split.exercises.map((template) => {
      const exerciseDbId = resolveExerciseDbIdFromName(template.name) ?? undefined;
      const exerciseId = exerciseDbId ? toExerciseUuid(exerciseDbId) : toExerciseUuid(template.name);
      const manual = (exerciseId in allSettings ? allSettings[exerciseId] : exerciseDbId && exerciseDbId in allSettings ? allSettings[exerciseDbId] : null) ?? null;
      const resolvedDetail = todayDetailsByName.get(normalizeExerciseName(template.name));
      const built = buildExerciseFromRoutineTemplate({
        name: template.name,
        targetSets: template.targetSets,
        targetReps: template.targetReps,
        restTimer: template.restTimer,
        suggestedWeight: template.suggestedWeight ?? 0,
      }, 120);
      const resolvedTargetReps = getResolvedTargetReps(resolvedDetail, template.targetReps);
      const resolvedTargetWeightLb = getResolvedTargetWeightLb(resolvedDetail);
      return {
        ...built,
        sets: built.sets.map((set) => ({
          ...set,
          reps: resolvedTargetReps,
          weight: resolvedTargetWeightLb ?? set.weight,
        })),
        exerciseDbId,
        repRangeLow: resolvedDetail?.repRangeLow ?? manual?.repRangeLow ?? template.targetReps,
        repRangeHigh: resolvedDetail?.repRangeHigh ?? manual?.repRangeHigh ?? template.targetReps,
        smallestIncrement: resolvedDetail?.smallestIncrementKg ?? manual?.smallestIncrement ?? 2.5,
      };
    });
    const newWorkout: WorkoutSession = {
      id: generateId(),
      date: new Date().toISOString(),
      name: split.name,
      exercises,
      duration: 0,
      isComplete: false,
    };
    setActiveWorkout(newWorkout);
    setCurrentExerciseIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const startWorkoutFromSavedRoutine = async (routine: SavedRoutine, defaultRestTimer: number = 120) => {
    const allSettings = await getAllExerciseSettings();
    const exercises: Exercise[] = routine.exercises.map((ex) => {
      const built = buildExerciseFromRoutineTemplate(ex, defaultRestTimer);
      const exerciseDbId = ex.exerciseDbId ?? resolveExerciseDbIdFromName(ex.name) ?? undefined;
      const exerciseId = exerciseDbId ? toExerciseUuid(exerciseDbId) : toExerciseUuid(ex.name);
      const manual = (exerciseId in allSettings ? allSettings[exerciseId] : exerciseDbId && exerciseDbId in allSettings ? allSettings[exerciseDbId] : null) ?? null;
      return {
        ...built,
        exerciseDbId,
        repRangeLow: manual?.repRangeLow ?? ex.targetReps,
        repRangeHigh: manual?.repRangeHigh ?? ex.targetReps,
        smallestIncrement: manual?.smallestIncrement ?? 2.5,
      };
    });
    const newWorkout: WorkoutSession = {
      id: generateId(),
      date: new Date().toISOString(),
      name: routine.name,
      exercises,
      duration: 0,
      isComplete: false,
    };
    setActiveWorkout(newWorkout);
    setCurrentExerciseIndex(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const startFreeformWorkout = () => {
    const newWorkout: WorkoutSession = {
      id: generateId(),
      date: new Date().toISOString(),
      name: 'Workout',
      exercises: [],
      duration: 0,
      isComplete: false,
    };
    setActiveWorkout(newWorkout);
  };

  const addExerciseFromPicker = (exercise: { id: string; name: string; exerciseDbId: string; restTimer: number }) => {
    if (!activeWorkout) return;
    const newExercise: Exercise = {
      id: generateId(),
      name: exercise.name,
      sets: [],
      restTimer: exercise.restTimer,
      exerciseDbId: exercise.exerciseDbId,
    };
    setActiveWorkout({ ...activeWorkout, exercises: [...activeWorkout.exercises, newExercise] });
  };

  const openExercisePicker = () => { setReplaceExerciseIndex(null); setShowExercisePicker(true); };
  const openExercisePickerForReplace = (exerciseIndex: number) => { setReplaceExerciseIndex(exerciseIndex); setShowExercisePicker(true); };

  const removeExercise = (exerciseIndex: number) => {
    if (!activeWorkout) return;
    const updatedExercises = activeWorkout.exercises.filter((_, i) => i !== exerciseIndex);
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const showExerciseMenu = (exerciseIndex: number) => setExerciseMenuIndex(exerciseIndex);
  const closeExerciseMenu = () => setExerciseMenuIndex(null);
  const handleReplaceFromMenu = () => {
    if (exerciseMenuIndex === null) return;
    openExercisePickerForReplace(exerciseMenuIndex);
    closeExerciseMenu();
  };
  const handleDeleteFromMenu = () => {
    if (exerciseMenuIndex === null) return;
    removeExercise(exerciseMenuIndex);
    closeExerciseMenu();
  };

  const addSet = (exerciseIndex: number) => {
    if (!activeWorkout) return;
    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise) return;
    const newSet: Set = { id: generateId(), weight: 0, reps: 0, completed: false };
    const updatedExercise = { ...exercise, sets: [...exercise.sets, newSet] };
    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = updatedExercise;
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
    if (restTimerActive && exercise.restTimer) {
      startRestTimer(exercise.restTimer, updatedExercise.sets.length, exerciseIndex);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const openSetNotesModal = (exerciseIndex: number, setIndex: number) => {
    const set = activeWorkout?.exercises[exerciseIndex]?.sets[setIndex];
    if (set) {
      setEditingNotes({ exerciseIndex, setIndex });
      setSetNotesText(set.notes || '');
      setShowSetNotesModal(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const openExerciseNotesModal = (exerciseIndex: number) => {
    const exercise = activeWorkout?.exercises[exerciseIndex];
    if (exercise) {
      setEditingNotes({ exerciseIndex });
      setSetNotesText(exercise.notes || '');
      setShowSetNotesModal(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const saveNotes = () => {
    if (editingNotes) {
      if (editingNotes.setIndex !== undefined) {
        updateSet(editingNotes.exerciseIndex, editingNotes.setIndex, { notes: setNotesText });
      } else {
        updateExerciseNotes(editingNotes.exerciseIndex, setNotesText);
      }
      setShowSetNotesModal(false);
      setEditingNotes(null);
      setSetNotesText('');
    }
  };

  const updateSet = (exerciseIndex: number, setIndex: number, updates: { weight?: number; reps?: number; completed?: boolean; notes?: string; rpe?: number | null }) => {
    if (!activeWorkout) return;
    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise || !exercise.sets[setIndex]) return;
    let weightUpdate: number | undefined;
    if (updates.weight !== undefined) weightUpdate = fromDisplayWeight(updates.weight, weightUnit);
    const updatedSets = [...exercise.sets];
    updatedSets[setIndex] = {
      ...updatedSets[setIndex],
      ...(weightUpdate !== undefined && { weight: weightUpdate }),
      ...(updates.reps !== undefined && { reps: updates.reps }),
      ...(updates.completed !== undefined && { completed: updates.completed }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
      ...(updates.rpe !== undefined && { rpe: updates.rpe }),
    };
    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = { ...exercise, sets: updatedSets };
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    if (!activeWorkout) return;
    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise || !exercise.sets[setIndex]) return;
    const updatedSets = exercise.sets.filter((_, i) => i !== setIndex);
    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = { ...exercise, sets: updatedSets };
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const updateExerciseNotes = (exerciseIndex: number, notes: string) => {
    if (!activeWorkout) return;
    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = { ...updatedExercises[exerciseIndex], notes };
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const updateExerciseRestTimer = (exerciseIndex: number, restTimer: number) => {
    if (!activeWorkout) return;
    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise) return;
    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = { ...exercise, restTimer };
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const bumpRemainingSetWeights = useCallback((
    exerciseIndex: number,
    completedSetIndex: number,
    bumpedWeightLb: number,
  ): number | null => {
    if (!activeWorkout) return null;
    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise) return null;
    const currentWeightLb = exercise.sets[completedSetIndex]?.weight ?? 0;
    if (currentWeightLb === 0) return null;
    let anyBumped = false;
    const updatedSets = exercise.sets.map((s, i) => {
      if (i <= completedSetIndex) return s;
      if (s.completed) return s;
      if (s.weight !== 0 && s.weight !== currentWeightLb) return s;
      anyBumped = true;
      return { ...s, weight: bumpedWeightLb };
    });
    if (!anyBumped) return null;
    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = { ...exercise, sets: updatedSets };
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
    return toDisplayWeight(bumpedWeightLb, weightUnit);
  }, [activeWorkout, weightUnit, setActiveWorkout]);

  const handleRpeCommit = useCallback((exerciseIndex: number, setIndex: number, rpe: number) => {
    if (!enableRpeBump || !shouldTriggerLowRpeWarning(rpe)) return;
    const exercise = activeWorkout?.exercises[exerciseIndex];
    const hasNextSet = (exercise?.sets.length ?? 0) > setIndex + 1;
    if (!hasNextSet) return;
    const exName = exercise?.name ?? '';
    const exKey = exercise?.exerciseDbId ?? exercise?.name;
    const prescription = exKey ? prescriptions[exKey] : null;
    const band = ((prescription?.difficultyBand ?? 'easy') as DifficultyBand);
    const category = resolveOverloadCategory(exercise?.exerciseDbId, exName);
    const incrementKg = getIncrementKg(category, band);
    const currentWeightLb = exercise?.sets[setIndex]?.weight ?? 0;
    const bumpedWeightLb = currentWeightLb > 0 ? currentWeightLb + incrementKg * LB_PER_KG : 0;
    if (bumpedWeightLb > 0) {
      const display = bumpRemainingSetWeights(exerciseIndex, setIndex, bumpedWeightLb);
      weightBumpDisplayRef.current[`${exerciseIndex}-${setIndex}`] = display != null ? String(display) : null;
    }
  }, [enableRpeBump, activeWorkout, prescriptions, bumpRemainingSetWeights]);

  const handleRpeCheckComplete = useCallback((rpe: number, exerciseName: string, exerciseIndex: number, setIndex: number) => {
    if (!enableRpeBump || !onRpeWarning) return;
    const weightBumpDisplay = weightBumpDisplayRef.current[`${exerciseIndex}-${setIndex}`] ?? null;
    delete weightBumpDisplayRef.current[`${exerciseIndex}-${setIndex}`];
    setTimeout(() => onRpeWarning(rpe, exerciseName, weightBumpDisplay), 150);
  }, [enableRpeBump, onRpeWarning]);

  const startRestTimer = async (seconds: number, setNumber: number, exerciseIdx?: number, setId?: string) => {
    if (hasActiveRestTimer()) {
      return;
    }
    if (restTimerNotificationId) {
      await cancelNotification(restTimerNotificationId);
      setRestTimerNotificationId(null);
    }
    restTimerEndRef.current = Date.now() + seconds * 1000;
    setRestTimeRemaining(seconds);
    setRestTimerActive(true);
    const idx = exerciseIdx ?? currentExerciseIndex;
    const exerciseName = activeWorkout?.exercises[idx]?.name || 'Exercise';
    const setNumberDisplay = setNumber + 1;
    setRestTimerContext({ exerciseName, setNumberDisplay });
    updateToRestTimer(exerciseName, setNumberDisplay, seconds);
    try {
      const notificationId = await scheduleRestTimerNotification(exerciseName, setNumberDisplay, seconds);
      setRestTimerNotificationId(notificationId);
    } catch (error) {
      console.error('Failed to schedule rest timer notification:', error);
    }
  };

  const skipRestTimer = (setId?: string) => {
    if (restTimerNotificationId) {
      cancelNotification(restTimerNotificationId);
      setRestTimerNotificationId(null);
    }
    restTimerEndRef.current = null;
    cancelRestTimerActivity();
    setRestTimerContext(null);
    setRestTimerActive(false);
    setRestTimeRemaining(0);
  };

  const adjustRestTimer = async (delta: number) => {
    const before = restTimeRemaining;
    const after = Math.max(0, before + delta);
    if (after === 0) {
      if (restTimerNotificationId) {
        await cancelNotification(restTimerNotificationId);
        setRestTimerNotificationId(null);
      }
      restTimerEndRef.current = null;
      cancelRestTimerActivity();
      setRestTimerContext(null);
      setRestTimerActive(false);
      setRestTimeRemaining(0);
      return;
    }
    restTimerEndRef.current = Date.now() + after * 1000;
    setRestTimeRemaining(after);
    if (restTimerNotificationId) {
      await cancelNotification(restTimerNotificationId);
      setRestTimerNotificationId(null);
    }
    const ctx = restTimerContext;
    if (!ctx) return;
    try {
      const notificationIdNew = await scheduleRestTimerNotification(ctx.exerciseName, ctx.setNumberDisplay, after);
      setRestTimerNotificationId(notificationIdNew);
    } catch (error) {
      console.error('Failed to reschedule rest timer notification:', error);
    }
  };

  const finishWorkout = async () => {
    if (isSavingWorkout) return;
    if (!activeWorkout) return;
    setIsSavingWorkout(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const latest = activeWorkoutRef.current;
      if (!latest) {
        setIsSavingWorkout(false);
        return;
      }
      const payload = buildCompletedWorkoutSession(latest);
      const invalid = getInvalidCompletedSets(payload);
      if (invalid.length > 0) {
        const msg = invalid.length === 1
          ? `Set ${invalid[0].setIndex} of ${invalid[0].exerciseName} has invalid data (weight > 0, reps ≥ 1, RPE 1–10). Fix it before saving.`
          : `${invalid.length} sets have invalid data. Each completed set needs weight > 0, reps ≥ 1, and RPE 1–10 if set. Fix them before saving.`;
        Alert.alert('Invalid set data', msg);
        return;
      }
      const totalExercises = payload.exercises?.length ?? 0;
      const completedSets = (payload.exercises ?? []).reduce(
        (acc, ex) => acc + (ex.sets ?? []).filter((s) => s.completed).length,
        0
      );
      if (totalExercises === 0 || completedSets === 0) {
        Alert.alert('No workout data', 'Add at least one completed set before saving.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCloseModal?.();
      await onFinish(payload);
    } catch (e) {
      if (__DEV__) console.warn('[Workout UI] save failed:', e);
      Alert.alert('Save failed', 'Could not save workout. Try again.', [{ text: 'OK' }]);
    } finally {
      setIsSavingWorkout(false);
    }
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const completedSetsCount = activeWorkout?.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  ) ?? 0;
  const totalVolumeRawLb = activeWorkout?.exercises.reduce(
    (acc, ex) =>
      acc + ex.sets.filter((s) => s.completed).reduce((s, set) => s + set.weight * set.reps, 0),
    0
  ) ?? 0;
  const totalVolumeDisplay = toDisplayVolume(totalVolumeRawLb, weightUnit);

  const handleMinimize = () => {
    setRestTimerActive(false);
    setRestTimeRemaining(0);
    minimizeWorkout();
    onCloseModal?.();
  };

  const windowHeight = Dimensions.get('window').height;
  const overlayEntranceY = useSharedValue(24);
  const overlayEntranceOpacity = useSharedValue(0);
  const [overlayTrigger, setOverlayTrigger] = useState(0);

  useEffect(() => {
    if (activeWorkout && !minimized) {
      setOverlayTrigger((t) => t + 1);
      overlayEntranceY.value = 24;
      overlayEntranceOpacity.value = 0;
      overlayEntranceY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
      overlayEntranceOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    }
  }, [activeWorkout?.id, minimized]);

  const overlayEntranceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: overlayEntranceY.value }],
    opacity: overlayEntranceOpacity.value,
  }));

  const scrollToSetRow = useCallback((exerciseIndex: number, setIndex: number) => {
    const blockY = setTableBlockYRef.current.get(exerciseIndex);
    const rowY = setTableRowYRef.current.get(`${exerciseIndex}-${setIndex}`);
    const scrollRef = workoutScrollRef.current;
    if (scrollRef != null && typeof blockY === 'number' && typeof rowY === 'number') {
      scrollRef.scrollTo({ y: Math.max(0, blockY + rowY - 100), animated: true });
    }
  }, []);

  const insets = useSafeAreaInsets();

  if (!activeWorkout || minimized) return null;

  const scrollProps = {};

  const handleFinishPress = () => {
    if (isSavingWorkout) return;
    Alert.alert('Finish Workout', 'Save this workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: finishWorkout },
    ]);
  };

  return (
    <>
      <AnimatedReanimated.View
        style={[
          styles.workoutOverlay,
          { backgroundColor: colors.primaryDark, height: windowHeight },
          overlayEntranceStyle,
        ]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          {useStickyHeader && (
            <StickyWorkoutHeader
              workoutName={activeWorkout.name || 'Workout'}
              elapsedSeconds={elapsedSeconds}
              totalVolumeDisplay={totalVolumeDisplay}
              weightUnit={weightUnit}
              completedSetsCount={completedSetsCount}
              exerciseCount={activeWorkout.exercises.length}
              onFinish={handleFinishPress}
              onMinimize={handleMinimize}
              paddingTop={insets.top}
              colors={{
                primaryDark: colors.primaryDark,
                primaryLight: colors.primaryLight,
                tabBarBorder: colors.tabBarBorder as [string, string],
                tabBarFill: colors.tabBarFill as [string, string],
              }}
              enableStatsModal={enableStatsModal}
              onStatsVolumePress={enableStatsModal ? () => { setStatsModalTab('volume'); setShowStatsModal(true); } : undefined}
              onStatsSetsPress={enableStatsModal ? () => { setStatsModalTab('sets'); setShowStatsModal(true); } : undefined}
            />
          )}
          <ScrollView
            ref={workoutScrollRef}
            {...scrollProps}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.contentContainer,
              {
                paddingTop: useStickyHeader ? insets.top + STICKY_HEADER_HEIGHT + 12 : insets.top + 12,
                paddingBottom: Math.max(160, insets.bottom + 120),
                paddingLeft: Math.max(8, insets.left),
                paddingRight: Math.max(8, insets.right),
              },
            ]}
          >
            <Pressable style={{ flex: 1 }} onPress={() => setCommitOutsideTrigger((t) => t + 1)}>
              {!useStickyHeader && (
                <AnimatedFadeInUp delay={0} duration={280} trigger={overlayTrigger} instant>
                  <View style={[styles.logTopBar, { paddingVertical: 8, paddingLeft: 4, paddingRight: insets.right + 4 }]}>
                    <AnimatedPressable
                      onPressIn={playIn}
                      onPressOut={playOut}
                      onPress={handleMinimize}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.logBackArrowWrap}
                    >
                      <View style={styles.minimizeIconButton}>
                        <LinearGradient
                          colors={colors.tabBarBorder as [string, string]}
                          style={[StyleSheet.absoluteFillObject, { borderRadius: 15 }]}
                        />
                        <LinearGradient
                          colors={colors.tabBarFill as [string, string]}
                          style={{ position: 'absolute', top: 1, left: 1, right: 1, bottom: 1, borderRadius: 14 }}
                        />
                        <Ionicons name="chevron-down" size={18} color={colors.primaryLight} />
                      </View>
                    </AnimatedPressable>
                    <View style={styles.logTopCenter} pointerEvents="box-none">
                      <Text style={[styles.logTitle, { color: colors.primaryLight }]}>{activeWorkout.name || 'Workout'}</Text>
                      <Text style={[styles.logTimer, { color: colors.primaryLight + '99' }]}>{formatElapsed(elapsedSeconds)}</Text>
                    </View>
                    <AnimatedPressable
                      style={[styles.finishButton, { backgroundColor: colors.primaryLight }]}
                      onPressIn={playIn}
                      onPressOut={playOut}
                      onPress={handleFinishPress}
                      disabled={isSavingWorkout}
                    >
                      <Text style={[styles.finishButtonText, { color: colors.primaryDark }]}>Finish</Text>
                    </AnimatedPressable>
                  </View>
                </AnimatedFadeInUp>
              )}

              {!useStickyHeader && (
                <AnimatedFadeInUp delay={50} duration={300} trigger={overlayTrigger} instant>
                  <View style={styles.summaryRow}>
                    {enableStatsModal ? (
                      <>
                        <Pressable
                          style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}
                          onPress={() => { setStatsModalTab('volume'); setShowStatsModal(true); }}
                          hitSlop={6}
                        >
                          <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>⚖</Text>
                          <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{Math.round(totalVolumeDisplay).toLocaleString()}</Text>
                          <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>{weightUnit}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}
                          onPress={() => { setStatsModalTab('sets'); setShowStatsModal(true); }}
                          hitSlop={6}
                        >
                          <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>◉</Text>
                          <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{completedSetsCount}</Text>
                          <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>sets</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <View style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}>
                          <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>⚖</Text>
                          <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{Math.round(totalVolumeDisplay).toLocaleString()}</Text>
                          <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>{weightUnit}</Text>
                        </View>
                        <View style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}>
                          <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>◉</Text>
                          <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{completedSetsCount}</Text>
                          <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>sets</Text>
                        </View>
                      </>
                    )}
                    <View style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}>
                      <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>◎</Text>
                      <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{activeWorkout.exercises.length}</Text>
                      <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>exercises</Text>
                    </View>
                  </View>
                </AnimatedFadeInUp>
              )}

              {restTimerVisible && (
                <AnimatedReanimated.View style={[styles.restTimerPanelWrapper, restTimerPanelStyle]}>
                  <View style={[styles.restTimerPanel, { backgroundColor: colors.primaryLight + '08', borderColor: colors.primaryLight + '20' }]}>
                    <AnimatedReanimated.View style={[styles.restTimerRow, rtRow0Style]}>
                      <Text style={[styles.restTimerLabel, { color: colors.primaryLight + '80' }]}>REST TIMER</Text>
                    </AnimatedReanimated.View>
                    <AnimatedReanimated.View style={rtRow1Style}>
                      <Text style={[styles.restTimerCountdown, { color: colors.primaryLight }]}>{formatDuration(restTimeRemaining)}</Text>
                    </AnimatedReanimated.View>
                    <AnimatedReanimated.View style={[{ width: '100%' }, rtRow2Style]}>
                      <View style={[styles.restTimerProgressTrack, { backgroundColor: colors.primaryLight + '15' }]}>
                        <View style={[styles.restTimerProgressFill, { backgroundColor: colors.primaryLight, width: `${Math.max(0, (restTimeRemaining / (activeWorkout.exercises[currentExerciseIndex]?.restTimer || 120)) * 100)}%` }]} />
                      </View>
                    </AnimatedReanimated.View>
                    <AnimatedReanimated.View style={[styles.restTimerButtonsRow, rtRow3Style]}>
                      <AnimatedPressable
                        style={[styles.restTimerAdjustButton, { backgroundColor: colors.primaryLight + '15' }]}
                        onPressIn={playIn}
                        onPressOut={playOut}
                        onPress={() => adjustRestTimer(-15)}
                      >
                        <Text style={[styles.restTimerAdjustButtonText, { color: colors.primaryLight }]}>−15s</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        style={[styles.restTimerSkipButton, { backgroundColor: colors.primaryLight }]}
                        onPressIn={playIn}
                        onPressOut={playOut}
                        onPress={() => skipRestTimer()}
                      >
                        <Text style={[styles.restTimerSkipButtonText, { color: colors.primaryDark }]}>Skip</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        style={[styles.restTimerAdjustButton, { backgroundColor: colors.primaryLight + '15' }]}
                        onPressIn={playIn}
                        onPressOut={playOut}
                        onPress={() => adjustRestTimer(15)}
                      >
                        <Text style={[styles.restTimerAdjustButtonText, { color: colors.primaryLight }]}>+15s</Text>
                      </AnimatedPressable>
                    </AnimatedReanimated.View>
                  </View>
                </AnimatedReanimated.View>
              )}

              {activeWorkout.exercises.length === 0 ? (
                <AnimatedFadeInUp delay={100} duration={320} trigger={overlayTrigger} instant>
                  <AnimatedPressable
                    style={[styles.addSetButtonBlock, styles.addExerciseBlock, { backgroundColor: colors.primaryLight + '15' }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={openExercisePicker}
                  >
                    <Text style={[styles.addSetButtonBlockText, { color: colors.primaryLight + '90' }]}>+ Add exercise</Text>
                  </AnimatedPressable>
                </AnimatedFadeInUp>
              ) : null}

              {activeWorkout.exercises.map((exercise, exerciseIndex) => (
                <AnimatedFadeInUp key={exercise.id} delay={100 + exerciseIndex * 45} duration={320} trigger={overlayTrigger} instant>
                  <View
                    style={[styles.exerciseBlock, { backgroundColor: colors.primaryLight + '08', borderColor: colors.primaryLight + '15' }, reorderHandle.getCardStyle(exerciseIndex)]}
                    onLayout={(e) => setTableBlockYRef.current.set(exerciseIndex, e.nativeEvent.layout.y)}
                  >
                    <View style={styles.exerciseBlockHeader}>
                      {enableReorder ? (
                        <Pressable
                          onLongPress={() => reorderHandle.onLongPress(exerciseIndex)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={[styles.dragHandle, reorderHandle.getDragHandleStyle(exerciseIndex)]}
                        >
                          <Text style={{ fontSize: 16, color: colors.primaryLight + '80', letterSpacing: 1 }}>≡</Text>
                        </Pressable>
                      ) : null}
                      <View style={styles.exerciseBlockTitleRow}>
                        <View style={[styles.exerciseBlockIcon, { backgroundColor: colors.primaryLight + '15' }]}>
                          <Text style={[styles.exerciseBlockIconText, { color: colors.primaryLight + '80' }]}>◆</Text>
                        </View>
                        <Text style={[styles.exerciseBlockName, { color: colors.primaryLight }]}>{exercise.name}</Text>
                      </View>
                      {enableReorder && reorderHandle.activeIndex === exerciseIndex ? (
                        <View style={styles.reorderControls}>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={reorder.moveUp}
                            disabled={exerciseIndex === 0}
                          >
                            <Text style={[styles.reorderArrow, { color: exerciseIndex === 0 ? colors.primaryLight + '30' : colors.primaryLight + 'CC' }]}>↑</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={reorder.moveDown}
                            disabled={exerciseIndex === activeWorkout.exercises.length - 1}
                          >
                            <Text style={[styles.reorderArrow, { color: exerciseIndex === activeWorkout.exercises.length - 1 ? colors.primaryLight + '30' : colors.primaryLight + 'CC' }]}>↓</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={reorder.cancel}
                          >
                            <Text style={[styles.reorderArrow, { color: colors.primaryLight + '60', fontSize: 13 }]}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => showExerciseMenu(exerciseIndex)}
                        >
                          <Text style={[styles.exerciseBlockMenu, { color: colors.primaryLight + '60' }]}>⋮</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {exercise.restTimer ? (
                      <Pressable
                        onPressIn={playIn}
                        onPressOut={playOut}
                        onPress={() => {
                          setRestEditMinutes(Math.floor(exercise.restTimer! / 60));
                          setRestEditSeconds(exercise.restTimer! % 60);
                          setRestTimeEditExerciseIndex(exerciseIndex);
                        }}
                        style={[styles.restTimerBadge, { backgroundColor: colors.primaryLight + '10' }]}
                      >
                        <Text style={[styles.restTimerBadgeText, { color: colors.primaryLight }]}>
                          Rest: {formatDuration(exercise.restTimer)}
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable onPress={() => openExerciseNotesModal(exerciseIndex)}>
                      <Text style={[styles.notesPlaceholder, { color: colors.primaryLight + (exercise.notes ? '90' : '50') }]}>
                        {exercise.notes ? exercise.notes : '+ Add notes'}
                      </Text>
                    </Pressable>

                    {(() => {
                      const exKey = exercise.exerciseDbId ?? exercise.name;
                      const { prevSets, ghostWeight, ghostReps, ghostReason } = exerciseProgressionMap.get(exercise.id) ?? { prevSets: [], ghostWeight: null, ghostReps: null, ghostReason: null };
                      const dbEx = (exercise.exerciseDbId && EXERCISE_MAP.get(exercise.exerciseDbId))
                        ?? userExercises.find((ue) => ue.id === exercise.exerciseDbId || ue.name === exercise.name);
                      const loadEntryMode = dbEx ? getLoadEntryModeForExercise(dbEx, userSettings) : 'total';
                      return (
                        <WorkoutSetTable
                          exercise={exercise}
                          exerciseIndex={exerciseIndex}
                          prevSets={prevSets}
                          ghostWeight={ghostWeight}
                          ghostReps={ghostReps}
                          ghostReason={ghostReason}
                          weightUnit={weightUnit}
                          colors={colors}
                          loadEntryMode={loadEntryMode}
                          updateSet={updateSet}
                          onRemoveSet={removeSet}
                          onAddSet={addSet}
                          onSetNotesPress={openSetNotesModal}
                          onRestTimerStart={(exIdx, setIdx, setId, durationSec) => startRestTimer(durationSec, setIdx, exIdx, setId)}
                          onRestTimerSkip={skipRestTimer}
                          keyboardHeight={keyboardHeight}
                          externalCommitTrigger={commitOutsideTrigger}
                          onFocusCell={scrollToSetRow}
                          onSetRowLayout={(exIdx, setIdx, y) => setTableRowYRef.current.set(`${exIdx}-${setIdx}`, y)}
                          playIn={playIn}
                          playOut={playOut}
                          onRpeCommit={enableRpeBump ? handleRpeCommit : undefined}
                          onRpeCheckComplete={enableRpeBump ? handleRpeCheckComplete : undefined}
                        />
                      );
                    })()}
                  </View>
                </AnimatedFadeInUp>
              ))}

              {activeWorkout.exercises.length > 0 ? (
                <AnimatedFadeInUp delay={100} duration={320} trigger={overlayTrigger} instant>
                  <AnimatedPressable
                    style={[styles.addSetButtonBlock, styles.addExerciseBlock, { backgroundColor: colors.primaryLight + '15' }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={openExercisePicker}
                  >
                    <Text style={styles.addSetButtonBlockText}>+ Add exercise</Text>
                  </AnimatedPressable>
                </AnimatedFadeInUp>
              ) : null}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>

        {enableStatsModal && (
          <ExerciseStatsModal
            visible={showStatsModal}
            onClose={() => setShowStatsModal(false)}
            exercises={(activeWorkout.exercises ?? []).map(ex => ({
              id: ex.id,
              name: ex.name,
              sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps, completed: s.completed })),
            }))}
            initialTab={statsModalTab}
            weightUnit={weightUnit}
          />
        )}
      </AnimatedReanimated.View>

      {restTimeEditExerciseIndex !== null && (
        <Modal visible animationType="fade" transparent>
          <Pressable style={styles.exerciseMenuOverlay} onPress={() => setRestTimeEditExerciseIndex(null)}>
            <Pressable
              style={[styles.restTimeEditCard, { backgroundColor: colors.primaryDark, borderColor: colors.primaryLight + '20' }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.restTimeEditTitle, { color: colors.primaryLight }]}>Edit rest time</Text>
              <Text style={[styles.restTimeEditDisplay, { color: colors.primaryLight }]}>
                {formatDuration(restEditMinutes * 60 + restEditSeconds)}
              </Text>
              <View style={styles.restTimeEditSliders}>
                <Text style={[styles.restTimeEditLabel, { color: colors.primaryLight + '80' }]}>Minutes</Text>
                <Slider
                  style={styles.restTimeSlider}
                  minimumValue={0}
                  maximumValue={10}
                  step={1}
                  value={restEditMinutes}
                  onValueChange={(v) => setRestEditMinutes(Math.round(v))}
                  minimumTrackTintColor={colors.primaryLight}
                  maximumTrackTintColor={colors.primaryLight + '40'}
                  thumbTintColor={colors.primaryLight}
                />
                <Text style={[styles.restTimeEditValue, { color: colors.primaryLight }]}>{restEditMinutes} min</Text>
              </View>
              <View style={styles.restTimeEditSliders}>
                <Text style={[styles.restTimeEditLabel, { color: colors.primaryLight + '80' }]}>Seconds</Text>
                <Slider
                  style={styles.restTimeSlider}
                  minimumValue={0}
                  maximumValue={59}
                  step={1}
                  value={restEditSeconds}
                  onValueChange={(v) => setRestEditSeconds(Math.round(v))}
                  minimumTrackTintColor={colors.primaryLight}
                  maximumTrackTintColor={colors.primaryLight + '40'}
                  thumbTintColor={colors.primaryLight}
                />
                <Text style={[styles.restTimeEditValue, { color: colors.primaryLight }]}>{restEditSeconds} s</Text>
              </View>
              <View style={styles.restTimeEditButtons}>
                <TouchableOpacity
                  style={[styles.restTimeEditButton, { backgroundColor: colors.primaryLight + '20' }]}
                  onPress={() => setRestTimeEditExerciseIndex(null)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.restTimeEditButtonText, { color: colors.primaryLight }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.restTimeEditButton, styles.restTimeEditButtonPrimary, { backgroundColor: colors.primaryLight }]}
                  onPress={() => {
                    updateExerciseRestTimer(restTimeEditExerciseIndex, restEditMinutes * 60 + restEditSeconds);
                    setRestTimeEditExerciseIndex(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.restTimeEditButtonText, styles.restTimeEditButtonTextPrimary, { color: colors.primaryDark }]}>Done</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {exerciseMenuIndex !== null && (
        <Modal visible animationType="fade" transparent>
          <Pressable style={[styles.exerciseMenuOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]} onPress={closeExerciseMenu}>
            <Pressable style={styles.exerciseMenuCardWrap} onPress={(e) => e.stopPropagation()}>
              <Card gradientFill borderRadius={20} style={styles.exerciseMenuCard}>
                <Text style={[styles.exerciseMenuTitle, { color: colors.primaryLight }]} numberOfLines={1}>
                  {activeWorkout.exercises[exerciseMenuIndex]?.name ?? 'Exercise'}
                </Text>
                <View style={styles.exerciseMenuButtons}>
                  <AnimatedPressable
                    style={[styles.exerciseMenuButtonReplace, { backgroundColor: colors.primaryDark, borderColor: colors.primaryLight + '20' }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={handleReplaceFromMenu}
                  >
                    <Text style={[styles.exerciseMenuButtonText, { color: colors.primaryLight }]}>Replace exercise</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={styles.exerciseMenuButtonDelete}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={handleDeleteFromMenu}
                  >
                    <Text style={styles.exerciseMenuButtonDeleteText}>Delete exercise</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={[styles.exerciseMenuButtonCancel, { borderColor: colors.primaryLight + '15' }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={closeExerciseMenu}
                  >
                    <Text style={[styles.exerciseMenuButtonText, { color: colors.primaryLight + '70' }]}>Cancel</Text>
                  </AnimatedPressable>
                </View>
              </Card>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <ExercisePickerModal
        visible={showExercisePicker}
        onClose={() => { setShowExercisePicker(false); setReplaceExerciseIndex(null); }}
        onSelect={(exercise) => {
          if (replaceExerciseIndex !== null) {
            const newEx: Exercise = {
              id: generateId(),
              name: exercise.name,
              sets: [],
              restTimer: exercise.restTimer,
              exerciseDbId: exercise.exerciseDbId,
            };
            const updated = [...activeWorkout.exercises];
            updated[replaceExerciseIndex] = newEx;
            setActiveWorkout({ ...activeWorkout, exercises: updated });
            setReplaceExerciseIndex(null);
          } else {
            addExerciseFromPicker(exercise);
          }
          setShowExercisePicker(false);
        }}
        defaultRestTimer={120}
        userExercises={userExercises}
        onCreateExercise={user?.id ? async (data: CreateExerciseInput) => supabaseInsertUserExercise(user.id, data) : undefined}
      />

      <Modal
        visible={showSetNotesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSetNotesModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowSetNotesModal(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardAvoiding}
          >
            <View style={styles.setNotesSheet}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>
                    {editingNotes?.setIndex !== undefined ? 'Set Notes' : 'Exercise Notes'}
                  </Text>
                  <Pressable
                    onPress={() => setShowSetNotesModal(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.primaryLight + '50'} />
                  </Pressable>
                </View>
              </View>
              <View style={styles.modalContent}>
                <TextInput
                  style={styles.setNotesInput}
                  value={setNotesText}
                  onChangeText={setSetNotesText}
                  placeholder={editingNotes?.setIndex !== undefined ? 'Add notes for this set...' : 'Add notes for this exercise...'}
                  placeholderTextColor={colors.primaryLight + '30'}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.saveNotesButton, { backgroundColor: colors.primaryLight }]}
                  onPress={saveNotes}
                >
                  <Text style={[styles.saveNotesButtonText, { color: colors.primaryDark }]}>Save Note</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  workoutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primaryDark,
    zIndex: 10,
  },
  logTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logTopCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBackArrowWrap: {
    padding: Spacing.xs,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizeIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logTimer: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primaryLight + '99',
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  logTitle: {
    fontSize: Typography.body,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  finishButton: {
    backgroundColor: Colors.primaryLight,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  finishButtonText: {
    fontSize: Typography.label,
    fontWeight: '700' as const,
    color: Colors.primaryDark,
    letterSpacing: -0.11,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    gap: 10,
  },
  summaryStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '12',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
  },
  summaryStatIcon: {
    fontSize: 12,
    color: Colors.primaryLight + '80',
  },
  summaryStatValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  summaryStatUnit: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + '80',
    letterSpacing: -0.11,
  },
  restTimerPanelWrapper: {
    overflow: 'visible' as const,
  },
  restTimerPanel: {
    marginBottom: Spacing.lg,
    paddingVertical: 20,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '08',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '20',
  },
  restTimerRow: {
    marginBottom: 8,
  },
  restTimerLabel: {
    fontSize: Typography.label,
    fontWeight: '700' as const,
    color: Colors.primaryLight + '80',
    letterSpacing: -0.11,
    textTransform: 'uppercase' as const,
  },
  restTimerCountdown: {
    fontSize: 52,
    fontWeight: '800' as const,
    color: Colors.primaryLight,
    marginBottom: 12,
    letterSpacing: -0.11,
  },
  restTimerProgressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.primaryLight + '15',
    borderRadius: 2,
    overflow: 'hidden' as const,
    marginBottom: 16,
  },
  restTimerProgressFill: {
    height: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 2,
  },
  restTimerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restTimerAdjustButton: {
    backgroundColor: Colors.primaryLight + '15',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  restTimerAdjustButtonText: {
    fontSize: Typography.label,
    fontWeight: '600' as const,
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  restTimerSkipButton: {
    backgroundColor: Colors.primaryLight,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  restTimerSkipButtonText: {
    fontSize: Typography.label,
    fontWeight: '700' as const,
    color: Colors.primaryDark,
    letterSpacing: -0.11,
  },
  exerciseBlock: {
    marginBottom: 12,
    backgroundColor: Colors.primaryLight + '08',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
    padding: Spacing.md,
    paddingBottom: 12,
  },
  exerciseBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dragHandle: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginRight: 2,
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reorderArrow: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 22,
  },
  exerciseBlockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  exerciseBlockIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseBlockIconText: {
    fontSize: 14,
    color: Colors.primaryLight + '80',
  },
  exerciseBlockName: {
    fontSize: Typography.body,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
    flex: 1,
  },
  exerciseBlockMenu: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.primaryLight + '60',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  exerciseMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  exerciseMenuCardWrap: {
    width: '100%',
    maxWidth: 320,
  },
  exerciseMenuCard: {
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  exerciseMenuTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '25',
  },
  exerciseMenuButtons: {
    gap: 10,
    marginTop: Spacing.sm,
  },
  exerciseMenuButtonReplace: {
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  exerciseMenuButtonText: {
    fontSize: Typography.label,
    fontWeight: '600',
    letterSpacing: -0.11,
  },
  exerciseMenuButtonDelete: {
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#C6C6C6',
  },
  exerciseMenuButtonDeleteText: {
    fontSize: Typography.label,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: '#2F3032',
  },
  exerciseMenuButtonCancel: {
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  restTimeEditCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  restTimeEditTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  restTimeEditDisplay: {
    fontSize: 28,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  restTimeEditSliders: {
    marginBottom: Spacing.md,
  },
  restTimeEditLabel: {
    fontSize: Typography.label,
    fontWeight: '600',
    marginBottom: 4,
  },
  restTimeSlider: {
    width: '100%',
    height: 40,
  },
  restTimeEditValue: {
    fontSize: Typography.body,
    marginTop: 2,
  },
  restTimeEditButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  restTimeEditButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  restTimeEditButtonPrimary: {},
  restTimeEditButtonText: {
    fontSize: Typography.body,
    fontWeight: '600',
  },
  restTimeEditButtonTextPrimary: {},
  restTimerBadge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight + '10',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  restTimerBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primaryLight + '80',
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  notesPlaceholder: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight + '50',
    marginBottom: 12,
  },
  addSetButtonBlock: {
    alignSelf: 'stretch',
    height: 36,
    backgroundColor: Colors.primaryLight + '15',
    marginTop: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addExerciseBlock: {
    marginTop: 12,
  },
  addSetButtonBlockText: {
    fontSize: Typography.label,
    fontWeight: '600' as const,
    color: Colors.primaryLight + '90',
    letterSpacing: -0.11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalKeyboardAvoiding: {
    width: '100%',
  },
  setNotesSheet: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    minHeight: 340,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  modalContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  setNotesInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    padding: 16,
    height: 140,
    color: Colors.primaryLight,
    fontSize: 16,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  saveNotesButton: {
    height: 56,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveNotesButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.11,
  },
});
