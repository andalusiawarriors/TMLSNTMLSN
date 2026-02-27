import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
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
  ImageBackground,
  NativeSyntheticEvent,
  NativeScrollEvent,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Input } from '../../../components/Input';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Font } from '../../../constants/theme';
import { TMLSN_SPLITS } from '../../../constants/workoutSplits';
import {
  saveWorkoutSession,
  getSavedRoutines,
  getUserSettings,
  getWorkoutSessions,
} from '../../../utils/storage';
import { toDisplayWeight, fromDisplayWeight, toDisplayVolume, formatWeightDisplay, parseNumericInput } from '../../../utils/units';
import { logStreakWorkout } from '../../../utils/streak';
import { WorkoutSession, Exercise, Set, WorkoutSplit, SavedRoutine } from '../../../types';
import { generateId, formatDuration, buildExerciseFromRoutineTemplate } from '../../../utils/helpers';
import { scheduleRestTimerNotification, cancelNotification } from '../../../utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useButtonSound } from '../../../hooks/useButtonSound';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { Card } from '../../../components/Card';
import { ExercisePickerModal } from '../../../components/ExercisePickerModal';
import { BlurView } from 'expo-blur';
import { UserPlus, At, Gear, List, Clock, Database } from 'phosphor-react-native';
import { format } from 'date-fns';
import { useTheme } from '../../../context/ThemeContext';
import { useActiveWorkout } from '../../../context/ActiveWorkoutContext';
import { BackButton } from '../../../components/BackButton';
import Slider from '@react-native-community/slider';


const formatRoutineTitle = (name: string) => {
  const lower = name.toLowerCase();
  const words = lower.split(' ');
  const lastWord = words[words.length - 1];
  if (lastWord.length === 1 && /[a-z]/.test(lastWord)) {
    words[words.length - 1] = lastWord.toUpperCase();
  }
  return words.join(' ');
};

/** Build a fresh WorkoutSession payload for save (from latest state). */
function buildCompletedWorkoutSession(w: WorkoutSession): WorkoutSession {
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
      sets: (ex.sets ?? []).map((s) => ({
        id: s.id,
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
      })),
    })),
    duration,
    isComplete: true,
  };
}
const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_WIDTH = Math.min(380, SCREEN_WIDTH - 40);
const PROGRESS_CARD_WIDTH = Math.min(380, SCREEN_WIDTH - 40);
const MAIN_MENU_BUTTON_HEIGHT = 69;
const MAIN_MENU_BUTTON_GAP = 15;
const PROGRESS_CARD_HEIGHT = 237;
const TOP_LEFT_PILL_TOP = 54; // Match home section layout
const SETTINGS_CIRCLE_SIZE = 40; // Match home profile circle
const THREE_BUTTON_STACK_HEIGHT = MAIN_MENU_BUTTON_HEIGHT * 3 + MAIN_MENU_BUTTON_GAP * 3; // 252
const SWIPE_PAGE_HEIGHT = THREE_BUTTON_STACK_HEIGHT;
const SWIPE_WIDGET_PADDING_TOP = 12;
const SWIPE_WIDGET_EXTRA_HEIGHT = 0;

/** Set table: shared flex ratios for header and every set row (balanced for phone width). */
const SET_TABLE_FLEX = {
  set: 0.85,
  previous: 1.0,
  weight: 0.95,
  reps: 0.95,
  check: 0.65,
} as const;
const SET_ROW_HEIGHT = 56;
const SET_INPUT_PILL_HEIGHT = 40;
const SET_INPUT_MAX_WIDTH = 68;
const SET_INPUT_MIN_WIDTH = 52;
const SET_INPUT_BORDER_WIDTH = 1;
const SET_INPUT_BORDER_RADIUS = 10;
const SET_INPUT_PADDING_H = 6;
const SET_CHECK_BUTTON_SIZE = 36;
if (__DEV__) {
  console.log('[Workout Set Table] column flex:', SET_TABLE_FLEX, 'input maxWidth=', SET_INPUT_MAX_WIDTH);
}

export type WorkoutScreenModalProps = {
  asModal?: boolean;
  initialActiveWorkout?: WorkoutSession | null;
  onCloseModal?: () => void;
};

const AnimatedSetNote = ({
  notes,
  isExpanded,
  onToggle,
  onEdit
}: {
  notes: string;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) => {
  const { colors } = useTheme();
  const open = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    open.value = withTiming(isExpanded ? 1 : 0, {
      duration: 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [isExpanded]);

  const bubbleStyle = useAnimatedStyle(() => {
    const v = open.value;
    return {
      transform: [{ scale: 0.985 + 0.015 * v }],
      opacity: 0.85 + 0.15 * v,
    };
  });

  return (
    <Pressable onPress={onToggle} hitSlop={8}>
      <AnimatedReanimated.View style={[styles.setNoteRowInner, bubbleStyle]}>
        {!isExpanded ? (
          <>
            <Text style={styles.setNoteText} numberOfLines={2} ellipsizeMode="tail">
              {notes}
            </Text>
            <Text style={styles.setNoteFadeHint}>tap to expand</Text>
          </>
        ) : (
          <>
            <Text style={styles.setNoteTextExpanded}>
              {notes}
            </Text>
            <Text style={styles.setNoteFadeHint}>tap to collapse</Text>

            <TouchableOpacity
              onPress={onEdit}
              style={styles.setNoteEditButton}
            >
              <Ionicons name="pencil-sharp" size={14} color={colors.primaryLight + '60'} />
              <Text style={styles.setNoteEditButtonText}>Edit Note</Text>
            </TouchableOpacity>
          </>
        )}
      </AnimatedReanimated.View>
    </Pressable>
  );
};

export default function WorkoutScreen({
  asModal = false,
  initialActiveWorkout = null,
  onCloseModal,
}: WorkoutScreenModalProps = {}) {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    activeWorkout,
    setActiveWorkout,
    currentExerciseIndex,
    setCurrentExerciseIndex,
    minimized,
    minimizeWorkout,
  } = useActiveWorkout();
  const { startSplitId, startRoutineId, startEmpty } = useLocalSearchParams<{
    startSplitId?: string;
    startRoutineId?: string;
    startEmpty?: string;
  }>();

  // Sync initialActiveWorkout (e.g. from modal) into context
  useEffect(() => {
    if (initialActiveWorkout) {
      setActiveWorkout(initialActiveWorkout);
      setCurrentExerciseIndex(0);
    }
  }, [initialActiveWorkout, setActiveWorkout, setCurrentExerciseIndex]);
  const [showSplitSelection, setShowSplitSelection] = useState(false);
  const [showExerciseEntry, setShowExerciseEntry] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  /** When set, picker is in "replace" mode: onSelect replaces this exercise index instead of appending */
  const [replaceExerciseIndex, setReplaceExerciseIndex] = useState<number | null>(null);
  /** When set, custom exercise menu (replace/delete) is open for this exercise index */
  const [exerciseMenuIndex, setExerciseMenuIndex] = useState<number | null>(null);
  /** When set, rest time edit modal is open for this exercise index */
  const [restTimeEditExerciseIndex, setRestTimeEditExerciseIndex] = useState<number | null>(null);
  const [restEditMinutes, setRestEditMinutes] = useState(0);
  const [restEditSeconds, setRestEditSeconds] = useState(0);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [animTrigger, setAnimTrigger] = useState(0);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);

  // Rest Timer State
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [restTimerNotificationId, setRestTimerNotificationId] = useState<string | null>(null);
  /** Context for rescheduling notification when user adjusts +/-15s (exercise name + set number for notification body). */
  const [restTimerContext, setRestTimerContext] = useState<{ exerciseName: string; setNumberDisplay: number } | null>(null);

  // ── Rest Timer panel enter/exit animation ──────────────────────────────────
  // `restTimerVisible` keeps the node mounted during the exit animation.
  // Shared values drive the outer wrapper and four staggered content rows.
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const restTimerOpacity = useSharedValue(0);
  const restTimerTranslateY = useSharedValue(-10);
  // Per-row stagger opacities (label row, countdown, progress bar, buttons row)
  const rtRow0Opacity = useSharedValue(0);
  const rtRow1Opacity = useSharedValue(0);
  const rtRow2Opacity = useSharedValue(0);
  const rtRow3Opacity = useSharedValue(0);

  const TIMER_ENTER_MS = 200;
  const TIMER_EXIT_MS = 160;
  const TIMER_STAGGER = 55; // ms between each inner row

  useEffect(() => {
    const shouldShow = restTimerActive && restTimeRemaining > 0;
    if (__DEV__) console.log('[Workout UI] rest timer visible:', shouldShow);
    if (shouldShow) {
      // Mount immediately, then animate in
      setRestTimerVisible(true);
      restTimerOpacity.value = withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) });
      restTimerTranslateY.value = withTiming(0, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) });
      // Stagger inner rows
      rtRow0Opacity.value = withDelay(0, withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
      rtRow1Opacity.value = withDelay(TIMER_STAGGER, withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
      rtRow2Opacity.value = withDelay(TIMER_STAGGER * 2, withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
      rtRow3Opacity.value = withDelay(TIMER_STAGGER * 3, withTiming(1, { duration: TIMER_ENTER_MS, easing: Easing.out(Easing.cubic) }));
    } else {
      // Animate out, then unmount
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
  // ───────────────────────────────────────────────────────────────────────────

  // Exercise Entry State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [editingCell, setEditingCell] = useState<{
    exerciseIndex: number;
    setIndex: number;
    field: 'weight' | 'reps';
  } | null>(null);
  /** Local string while editing weight/reps so value stays visible and stable until blur (parse then save). */
  const [editingCellValue, setEditingCellValue] = useState('');
  /** When set, this row's check button is pressed — highlight the whole set row. */
  const [pressedCheckRowKey, setPressedCheckRowKey] = useState<string | null>(null);
  /** Keyboard height for positioning the confirm bar above the keyboard. */
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Set/Exercise-level notes editor state
  const [showSetNotesModal, setShowSetNotesModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{ exerciseIndex: number; setIndex?: number } | null>(null);
  const [setNotesText, setSetNotesText] = useState('');
  // Track which set notes are expanded
  const [expandedSetNotes, setExpandedSetNotes] = useState<Record<string, boolean>>({});

  const { playIn, playOut } = useButtonSound();

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);


  // FAB "start empty workout" now always opens start-empty-workout-modal (no emit), so no subscription here.

  useEffect(() => {
    if (asModal || startEmpty !== '1') {
      if (!asModal) lastProcessedStartEmpty.current = false;
      return;
    }
    if (lastProcessedStartEmpty.current) return;
    lastProcessedStartEmpty.current = true;
    startFreeformWorkout();
    router.setParams({}); // clear param so back/return doesn't re-trigger
  }, [asModal, startEmpty]);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      getUserSettings().then((s) => setWeightUnit(s.weightUnit));
      getWorkoutSessions().then((all) => setRecentSessions(all.slice(0, 5)));
    }, [])
  );

  const lastProcessedStartEmpty = useRef(false);
  const lastProcessedSplitId = useRef<string | null>(null);
  const lastProcessedRoutineId = useRef<string | null>(null);
  const activeWorkoutRef = useRef<WorkoutSession | null>(null);
  const workoutScrollRef = useRef<ScrollView>(null);
  const setTableBlockYRef = useRef<Map<number, number>>(new Map());
  const setTableRowYRef = useRef<Map<string, number>>(new Map());
  const focusedInputWrapperRef = useRef<View | null>(null);
  /** Guard to prevent duplicate commit from blur + outside tap in same tick. */
  const commitInProgressRef = useRef(false);
  const scrollToSetRow = useCallback((exerciseIndex: number, setIndex: number) => {
    const blockY = setTableBlockYRef.current.get(exerciseIndex);
    const rowY = setTableRowYRef.current.get(`${exerciseIndex}-${setIndex}`);
    const scrollRef = workoutScrollRef.current;
    if (scrollRef != null && typeof blockY === 'number' && typeof rowY === 'number') {
      scrollRef.scrollTo({ y: Math.max(0, blockY + rowY - 100), animated: true });
    }
    if (__DEV__) console.log('[Workout Keyboard] input focused row/set', exerciseIndex, setIndex);
  }, []);

  /** Keyboard Done and overlay both call this; actual commit is in commitActiveFieldIfNeeded (defined after updateSet). */
  const confirmEditingCellRef = useRef<(source: 'done' | 'outside' | 'blur') => void>(() => { });
  const confirmEditingCell = useCallback(() => {
    confirmEditingCellRef.current('done');
  }, []);
  useEffect(() => {
    activeWorkoutRef.current = activeWorkout;
  }, [activeWorkout]);
  useEffect(() => {
    if (activeWorkout && !minimized && __DEV__) {
      console.log('[Workout UI] keyboard avoidance enabled');
    }
  }, [activeWorkout, minimized]);
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
    if (!activeWorkout) {
      setElapsedSeconds(0);
      setEditingCell(null);
      return;
    }
    const startMs = new Date(activeWorkout.date).getTime();
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - startMs) / 1000));
    };
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

  const startWorkoutFromSplit = (split: WorkoutSplit) => {
    const exercises: Exercise[] = split.exercises.map((template) => ({
      id: generateId(),
      name: template.name,
      sets: [],
      restTimer: template.restTimer,
    }));

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
    setShowSplitSelection(false);
    setShowExerciseEntry(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const startWorkoutFromSavedRoutine = (routine: SavedRoutine, defaultRestTimer: number = 120) => {
    const exercises: Exercise[] = routine.exercises.map((ex) =>
      buildExerciseFromRoutineTemplate(ex, defaultRestTimer)
    );

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
    setShowExerciseEntry(true);
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
    setShowSplitSelection(false);
    // Overlay shows first; user adds exercise via "+ Add exercise" in the overlay (no Alert here to avoid focus/cancel bugs)
  };

  const addExerciseFromPicker = (exercise: {
    id: string;
    name: string;
    exerciseDbId: string;
    restTimer: number;
  }) => {
    if (!activeWorkout) return;

    const newExercise: Exercise = {
      id: generateId(),
      name: exercise.name,
      sets: [],
      restTimer: exercise.restTimer,
      exerciseDbId: exercise.exerciseDbId,
    };
    setActiveWorkout({
      ...activeWorkout,
      exercises: [...activeWorkout.exercises, newExercise],
    });
    setShowExerciseEntry(true);
  };

  const openExercisePicker = () => {
    setReplaceExerciseIndex(null);
    setShowExercisePicker(true);
  };

  const openExercisePickerForReplace = (exerciseIndex: number) => {
    setReplaceExerciseIndex(exerciseIndex);
    setShowExercisePicker(true);
  };

  const removeExercise = (exerciseIndex: number) => {
    if (!activeWorkout) return;
    const updatedExercises = activeWorkout.exercises.filter((_, i) => i !== exerciseIndex);
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const showExerciseMenu = (exerciseIndex: number) => {
    setExerciseMenuIndex(exerciseIndex);
  };

  const closeExerciseMenu = () => {
    setExerciseMenuIndex(null);
  };

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

    const newSet: Set = {
      id: generateId(),
      weight: 0,
      reps: 0,
      completed: false,
    };

    const updatedExercise = {
      ...exercise,
      sets: [...exercise.sets, newSet],
    };

    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = updatedExercise;

    setActiveWorkout({
      ...activeWorkout,
      exercises: updatedExercises,
    });

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

  const updateSet = (exerciseIndex: number, setIndex: number, updates: { weight?: number; reps?: number; completed?: boolean; notes?: string }) => {
    if (!activeWorkout) return;
    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise || !exercise.sets[setIndex]) return;

    // Weight: updates.weight is always DISPLAY value; convert once to raw lb here.
    let weightUpdate: number | undefined;
    if (updates.weight !== undefined) {
      weightUpdate = fromDisplayWeight(updates.weight, weightUnit);
    }

    const updatedSets = [...exercise.sets];
    updatedSets[setIndex] = {
      ...updatedSets[setIndex],
      ...(weightUpdate !== undefined && { weight: weightUpdate }),
      ...(updates.reps !== undefined && { reps: updates.reps }),
      ...(updates.completed !== undefined && { completed: updates.completed }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
    };

    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = { ...exercise, sets: updatedSets };

    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  /** Field commit only: save typed value into set. Does NOT set completed or update top stats. */
  const commitActiveFieldIfNeeded = useCallback((source: 'done' | 'outside' | 'blur') => {
    if (!editingCell) return;
    if (commitInProgressRef.current) return;
    commitInProgressRef.current = true;

    const { exerciseIndex, setIndex, field } = editingCell;
    const exercise = activeWorkout?.exercises[exerciseIndex];
    const set = exercise?.sets[setIndex];

    if (field === 'weight') {
      const n = parseNumericInput(editingCellValue, 'float');
      if (n !== null) {
        updateSet(exerciseIndex, setIndex, { weight: n });
        if (__DEV__) console.log('[Workout Field Commit]', { setId: set?.id, field: 'weight', parsed: n, source });
      }
    } else {
      const n = parseNumericInput(editingCellValue, 'int');
      if (n !== null) {
        updateSet(exerciseIndex, setIndex, { reps: n });
        if (__DEV__) console.log('[Workout Field Commit]', { setId: set?.id, field: 'reps', parsed: n, source });
      }
    }

    if (__DEV__) console.log('[Workout Input] end edit', { setId: set?.id, field });
    setEditingCell(null);
    setEditingCellValue('');
    Keyboard.dismiss();
    // Reset synchronously — a setTimeout reset can leave the lock stranded if a
    // re-render fires between the dismiss and the timeout callback.
    commitInProgressRef.current = false;
  }, [editingCell, editingCellValue, weightUnit, activeWorkout, updateSet]);

  useEffect(() => {
    confirmEditingCellRef.current = commitActiveFieldIfNeeded;
  }, [commitActiveFieldIfNeeded]);

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

  const startRestTimer = async (seconds: number, setNumber: number, exerciseIdx?: number, setId?: string) => {
    if (restTimerNotificationId) {
      await cancelNotification(restTimerNotificationId);
      if (__DEV__ && setId) console.log('[Workout RestTimer] cancelled (replacing)', { setId, notificationId: restTimerNotificationId });
      setRestTimerNotificationId(null);
    }
    setRestTimeRemaining(seconds);
    setRestTimerActive(true);
    const idx = exerciseIdx ?? currentExerciseIndex;
    const exerciseName = activeWorkout?.exercises[idx]?.name || 'Exercise';
    const setNumberDisplay = setNumber + 1;
    setRestTimerContext({ exerciseName, setNumberDisplay });
    try {
      const notificationId = await scheduleRestTimerNotification(
        exerciseName,
        setNumberDisplay,
        seconds
      );
      setRestTimerNotificationId(notificationId);
      if (__DEV__ && setId) console.log('[Workout RestTimer] scheduled', { setId, seconds, notificationId });
    } catch (error) {
      console.error('Failed to schedule rest timer notification:', error);
    }
  };

  const skipRestTimer = (setId?: string) => {
    if (restTimerNotificationId) {
      cancelNotification(restTimerNotificationId);
      if (__DEV__ && setId) console.log('[Workout RestTimer] cancelled', { setId, notificationId: restTimerNotificationId });
      setRestTimerNotificationId(null);
    }
    setRestTimerContext(null);
    setRestTimerActive(false);
    setRestTimeRemaining(0);
  };

  /** Adjust rest timer by delta seconds and reschedule notification to match new remaining time. */
  const adjustRestTimer = async (delta: number) => {
    const before = restTimeRemaining;
    const after = Math.max(0, before + delta);
    const notificationIdOld = restTimerNotificationId;

    if (after === 0) {
      if (restTimerNotificationId) {
        await cancelNotification(restTimerNotificationId);
        setRestTimerNotificationId(null);
      }
      setRestTimerContext(null);
      setRestTimerActive(false);
      setRestTimeRemaining(0);
      if (__DEV__) console.log('[Workout RestTimer] adjust -> cancelled at zero', { before, after });
      return;
    }

    setRestTimeRemaining(after);
    if (restTimerNotificationId) {
      await cancelNotification(restTimerNotificationId);
      setRestTimerNotificationId(null);
    }

    const ctx = restTimerContext;
    if (!ctx) return;
    try {
      const notificationIdNew = await scheduleRestTimerNotification(
        ctx.exerciseName,
        ctx.setNumberDisplay,
        after
      );
      setRestTimerNotificationId(notificationIdNew);
      if (__DEV__) {
        const label = delta > 0 ? 'adjust +15' : 'adjust -15';
        console.log(`[Workout RestTimer] ${label}`, { before, after, notificationIdOld, notificationIdNew });
      }
    } catch (error) {
      console.error('Failed to reschedule rest timer notification:', error);
    }
  };

  const nextExercise = () => {
    if (!activeWorkout) return;
    if (isSavingWorkout) return;

    if (currentExerciseIndex < activeWorkout.exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
    } else {
      // All exercises complete
      Alert.alert(
        'Workout Complete',
        'Great job! Ready to save this workout?',
        [
          { text: 'Continue', style: 'cancel' },
          { text: 'Finish', onPress: finishWorkout },
        ]
      );
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
      const totalExercises = payload.exercises?.length ?? 0;
      const totalSets = (payload.exercises ?? []).reduce((acc, ex) => acc + (ex.sets ?? []).length, 0);
      const completedSets = (payload.exercises ?? []).reduce(
        (acc, ex) => acc + (ex.sets ?? []).filter((s) => s.completed).length,
        0
      );

      if (totalExercises === 0 || completedSets === 0) {
        Alert.alert('No workout data', 'Add at least one completed set before saving.');
        return;
      }

      await saveWorkoutSession(payload);
      await logStreakWorkout();

      setActiveWorkout(null);
      setShowExerciseEntry(false);
      setCurrentExerciseIndex(0);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCloseModal?.();
      router.push({ pathname: '/workout-save', params: { sessionId: payload.id } });
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

  /** Stats from COMPLETED sets only (row checkmark). Field commit does not affect these. */
  const completedSetsCount = activeWorkout?.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  ) ?? 0;
  const totalVolumeRawLb = activeWorkout?.exercises.reduce(
    (acc, ex) =>
      acc +
      ex.sets.filter((s) => s.completed).reduce((s, set) => s + set.weight * set.reps, 0),
    0
  ) ?? 0;
  const totalVolumeDisplay = toDisplayVolume(totalVolumeRawLb, weightUnit);

  useEffect(() => {
    if (!activeWorkout || !__DEV__) return;
    const completed = activeWorkout.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
      0
    );
    const vol = activeWorkout.exercises.reduce(
      (acc, ex) =>
        acc +
        ex.sets.filter((s) => s.completed).reduce((s, set) => s + set.weight * set.reps, 0),
      0
    );
    console.log('[Workout Stats]', { completedSets: completed, totalVolumeRawLb: vol });
  }, [activeWorkout]);

  const goBackToMainMenu = () => {
    setActiveWorkout(null);
    setShowExerciseEntry(false);
    setCurrentExerciseIndex(0);
    setRestTimerActive(false);
    setRestTimeRemaining(0);
    onCloseModal?.();
  };

  const handleMinimize = () => {
    setShowExerciseEntry(false);
    setRestTimerActive(false);
    setRestTimeRemaining(0);
    // Close overlay immediately — pill shows when minimized
    minimizeWorkout();
    onCloseModal?.();
  };

  const windowHeight = Dimensions.get('window').height;
  const overlayEntranceY = useSharedValue(24);
  const overlayEntranceOpacity = useSharedValue(0);
  const [overlayTrigger, setOverlayTrigger] = useState(0);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);

  useEffect(() => {
    if (activeWorkout && !minimized) {
      setOverlayTrigger((t) => t + 1);
      overlayEntranceY.value = 24;
      overlayEntranceOpacity.value = 0;
      overlayEntranceY.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.cubic),
      });
      overlayEntranceOpacity.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [activeWorkout?.id, minimized]);

  const overlayEntranceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: overlayEntranceY.value }],
    opacity: overlayEntranceOpacity.value,
  }));

  const handleBackArrowPress = () => {
    if (!activeWorkout) return;
    // Down arrow = minimize (HEVY-style), show pill, keep workout active
    handleMinimize();
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      {/* Workout home – background, header (settings | history), three start buttons */}
      {!asModal && !activeWorkout && (
        <>
          <View style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none">
            <ImageBackground
              source={require('../../../assets/home-background.png')}
              style={{ width: SCREEN_WIDTH, height: windowHeight, position: 'absolute', top: 0, left: 0 }}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['transparent', 'rgba(47, 48, 49, 0.4)', 'rgba(47, 48, 49, 0.85)', '#2F3031', '#1a1a1a']}
                locations={[0, 0.2, 0.35, 0.45, 0.65]}
                style={StyleSheet.absoluteFill}
              />
            </ImageBackground>
          </View>
          <View
            style={[
              styles.exploreHeader,
              styles.exploreHeaderOverlay,
              { paddingTop: 54, paddingHorizontal: Spacing.md + (insets.left || 0), paddingRight: Spacing.md + (insets.right || 0) },
            ]}
          >
            <Pressable onPress={() => router.push('/workout/settings')} style={styles.exploreHeaderIconWrap} hitSlop={12}>
              <Gear size={24} weight="regular" color={colors.primaryLight} />
            </Pressable>
            <View style={styles.exploreHeaderSpacer} />
            <Pressable onPress={() => router.push('/workout-history')} style={styles.exploreHeaderIconWrap} hitSlop={12}>
              <List size={24} weight="regular" color={colors.primaryLight} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingTop: 54 + 48,
              paddingBottom: Math.max(Spacing.xl, insets.bottom + 100),
              paddingHorizontal: Spacing.lg,
            }}
            showsVerticalScrollIndicator={false}
          >
            {recentSessions.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <Text style={{ color: colors.primaryLight + '60', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
                  {'Start a workout using\nthe + button below'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ color: colors.primaryLight + '80', fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 4 }}>Recent</Text>
                {recentSessions.map((session) => {
                  const rawVolume = session.exercises.reduce((acc: number, ex: any) =>
                    acc + ex.sets.filter((s: any) => s.completed).reduce((sacc: number, set: any) => sacc + (set.weight * set.reps), 0), 0);
                  const volumeDisplay = toDisplayVolume(rawVolume, weightUnit);
                  return (
                    <Pressable
                      key={session.id}
                      style={{
                        backgroundColor: colors.primaryLight + '08',
                        borderRadius: 14,
                        padding: Spacing.md,
                        marginBottom: Spacing.sm + 4,
                      }}
                      onPress={() => router.push({ pathname: '/workout-detail', params: { sessionId: session.id } })}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', letterSpacing: -0.2, color: colors.primaryLight }}>{session.name}</Text>
                        <Text style={{ fontSize: 13, color: colors.primaryLight + '50' }}>
                          {format(new Date(session.date), 'MMM d, yyyy')}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryLight + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                          <Clock size={13} color={colors.primaryLight + '80'} />
                          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.primaryLight + 'CC' }}>{session.duration}m</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.primaryLight + '12', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 }}>
                          <Database size={13} color={colors.primaryLight + '80'} />
                          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.primaryLight + 'CC' }}>{formatWeightDisplay(volumeDisplay, weightUnit)}</Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => router.push('/workout-history')}
                  style={{ alignItems: 'center', marginTop: 8, paddingVertical: 8 }}
                >
                  <Text style={{ color: colors.primaryLight + '60', fontSize: 14, fontWeight: '500' }}>
                    View all history
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </>
      )}

      {/* Workout log overlay – entrance animation + minimize on down arrow */}
      {activeWorkout && !minimized && (
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
            <ScrollView
              ref={workoutScrollRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.contentContainer,
                {
                  paddingTop: insets.top + 12,
                  paddingBottom: Math.max(160, insets.bottom + 120),
                  paddingLeft: Math.max(8, insets.left),
                  paddingRight: Math.max(8, insets.right),
                },
              ]}
            >
              <Pressable style={{ flex: 1 }} onPress={() => commitActiveFieldIfNeeded('outside')}>
                {/* ─── HEVY-STYLE TOP BAR ─── */}
                <AnimatedFadeInUp delay={0} duration={280} trigger={overlayTrigger} instant>
                  <View style={[styles.logTopBar, { paddingVertical: 8, paddingLeft: 4, paddingRight: insets.right + 4 }]}>
                    <AnimatedPressable
                      onPressIn={playIn}
                      onPressOut={playOut}
                      onPress={handleBackArrowPress}
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
                      onPress={() =>
                        isSavingWorkout
                          ? undefined
                          : Alert.alert(
                            'Finish Workout',
                            'Save this workout?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Save', onPress: finishWorkout },
                            ]
                          )
                      }
                      disabled={isSavingWorkout}
                    >
                      <Text style={[styles.finishButtonText, { color: colors.primaryDark }]}>Finish</Text>
                    </AnimatedPressable>
                  </View>
                </AnimatedFadeInUp>

                {/* ─── HEVY-STYLE SUMMARY STATS ROW (committed state only; draft never affects volume/sets) ─── */}
                <AnimatedFadeInUp delay={50} duration={300} trigger={overlayTrigger} instant>
                  <View style={styles.summaryRow}>
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
                    <View style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}>
                      <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>◎</Text>
                      <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{activeWorkout.exercises.length}</Text>
                      <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>exercises</Text>
                    </View>
                  </View>
                </AnimatedFadeInUp>

                {/* ─── HEVY-STYLE REST TIMER PANEL (animated enter/exit) ─── */}
                {restTimerVisible && (
                  <AnimatedReanimated.View style={[styles.restTimerPanelWrapper, restTimerPanelStyle]}>
                    <View style={[styles.restTimerPanel, { backgroundColor: colors.primaryLight + '08', borderColor: colors.primaryLight + '20' }]}>
                      {/* Row 0 – label */}
                      <AnimatedReanimated.View style={[styles.restTimerRow, rtRow0Style]}>
                        <Text style={[styles.restTimerLabel, { color: colors.primaryLight + '80' }]}>REST TIMER</Text>
                      </AnimatedReanimated.View>
                      {/* Row 1 – countdown */}
                      <AnimatedReanimated.View style={rtRow1Style}>
                        <Text style={[styles.restTimerCountdown, { color: colors.primaryLight }]}>{formatDuration(restTimeRemaining)}</Text>
                      </AnimatedReanimated.View>
                      {/* Row 2 – progress bar */}
                      <AnimatedReanimated.View style={[{ width: '100%' }, rtRow2Style]}>
                        <View style={[styles.restTimerProgressTrack, { backgroundColor: colors.primaryLight + '15' }]}>
                          <View style={[styles.restTimerProgressFill, { backgroundColor: colors.primaryLight, width: `${Math.max(0, (restTimeRemaining / (activeWorkout.exercises[currentExerciseIndex]?.restTimer || 120)) * 100)}%` }]} />
                        </View>
                      </AnimatedReanimated.View>
                      {/* Row 3 – buttons */}
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

                {/* ─── HEVY-STYLE EXERCISE BLOCKS ─── */}
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
                      style={[styles.exerciseBlock, { backgroundColor: colors.primaryLight + '08', borderColor: colors.primaryLight + '15' }]}
                      onLayout={(e) => setTableBlockYRef.current.set(exerciseIndex, e.nativeEvent.layout.y)}
                    >
                      {/* Exercise header */}
                      <View style={styles.exerciseBlockHeader}>
                        <View style={styles.exerciseBlockTitleRow}>
                          <View style={[styles.exerciseBlockIcon, { backgroundColor: colors.primaryLight + '15' }]}>
                            <Text style={[styles.exerciseBlockIconText, { color: colors.primaryLight + '80' }]}>◆</Text>
                          </View>
                          <Text style={[styles.exerciseBlockName, { color: colors.primaryLight }]}>{exercise.name}</Text>
                        </View>
                        <TouchableOpacity
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          onPress={() => showExerciseMenu(exerciseIndex)}
                        >
                          <Text style={[styles.exerciseBlockMenu, { color: colors.primaryLight + '60' }]}>⋮</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Rest timer badge – pressable to edit (only when rest timer is set) */}
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

                      {/* Notes */}
                      <Pressable onPress={() => openExerciseNotesModal(exerciseIndex)}>
                        <Text style={[styles.notesPlaceholder, { color: colors.primaryLight + (exercise.notes ? '90' : '50') }]}>
                          {exercise.notes ? exercise.notes : '+ Add notes'}
                        </Text>
                      </Pressable>

                      {/* Set table header — same flex column ratios as row cells */}
                      <View style={styles.setTableHeader}>
                        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.set }]}>
                          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">SET</Text>
                        </View>
                        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.previous }]}>
                          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">PREVIOUS</Text>
                        </View>
                        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.weight }]}>
                          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">{weightUnit.toUpperCase()}</Text>
                        </View>
                        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.reps }]}>
                          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1} ellipsizeMode="tail">REPS</Text>
                        </View>
                        <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.check }]}>
                          <Text style={[styles.setTableHeaderLabel, { color: colors.primaryLight + '50' }]} numberOfLines={1}>✓</Text>
                        </View>
                      </View>

                      {/* Set rows — same flex column ratios as header */}
                      {exercise.sets.map((set, setIndex) => {
                        const isCompleted = set.completed;
                        const rowKey = `${exerciseIndex}-${setIndex}`;
                        return (
                          <View
                            key={set.id}
                            style={styles.setBlock}
                            onLayout={(e) => setTableRowYRef.current.set(rowKey, e.nativeEvent.layout.y)}
                          >
                            <Swipeable
                              renderRightActions={() => (
                                <Pressable
                                  style={({ pressed }) => [styles.setRowDeleteAction, pressed && { opacity: 0.8 }]}
                                  onPressIn={playIn}
                                  onPressOut={playOut}
                                  onPress={() => removeSet(exerciseIndex, setIndex)}
                                >
                                  <Text style={styles.setRowDeleteText}>Delete</Text>
                                </Pressable>
                              )}
                              friction={2}
                              rightThreshold={40}
                            >
                              <View
                                style={[
                                  styles.setRowWrapper,
                                  isCompleted && pressedCheckRowKey !== rowKey && { backgroundColor: colors.primaryLight + '0A', borderColor: colors.primaryLight + '20' },
                                  pressedCheckRowKey === rowKey && { backgroundColor: colors.primaryLight + '18', borderColor: colors.primaryLight + '25' },
                                ]}
                              >
                                <View style={[styles.setRow, { borderBottomWidth: 1 }]}>
                                  <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.set }]}>
                                    <TouchableOpacity
                                      onPress={() => openSetNotesModal(exerciseIndex, setIndex)}
                                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                      style={styles.setDotPressable}
                                    >
                                      <View style={[styles.setDot, { borderColor: colors.primaryLight + '30' }, isCompleted && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }]}>
                                        <Text style={[styles.setDotText, { color: colors.primaryLight + '80' }, isCompleted && { color: colors.primaryDark }]}>
                                          {setIndex + 1}
                                        </Text>
                                      </View>
                                    </TouchableOpacity>
                                  </View>

                                  <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.previous }]}>
                                    <View style={styles.setPreviousTextWrap}>
                                      <Text
                                        style={[styles.setCellDim, { color: colors.primaryLight + '50' }, isCompleted && { color: colors.primaryLight + '70' }]}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                      >
                                        {setIndex > 0 && exercise.sets[setIndex - 1].weight > 0
                                          ? `${formatWeightDisplay(toDisplayWeight(exercise.sets[setIndex - 1].weight, weightUnit), weightUnit)}×${exercise.sets[setIndex - 1].reps}`
                                          : '—'}
                                      </Text>
                                    </View>
                                  </View>

                                  <View style={[styles.setTableCell, styles.setInputCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.weight, zIndex: 1 }]}>
                                    <View style={styles.setCellContentCenter}>
                                      {editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'weight' ? (
                                        <View
                                          ref={(r) => { focusedInputWrapperRef.current = r; }}
                                          onLayout={(e) => {
                                            if (!__DEV__) return;
                                            const { width, height } = e.nativeEvent.layout;
                                            console.log('[Workout Input UI] focus cell', { setId: set.id, field: 'weight', width, height });
                                          }}
                                          style={[
                                            styles.setInputCellBase,
                                            { borderColor: colors.primaryLight + '25', backgroundColor: colors.primaryLight + '08' },
                                            styles.setInputCellActiveVisual,
                                            { borderColor: colors.primaryLight + '45', backgroundColor: colors.primaryLight + '12' },
                                          ]}
                                          collapsable={false}
                                        >
                                          <Input
                                            value={editingCellValue}
                                            onChangeText={(text) => {
                                              setEditingCellValue(text);
                                              if (__DEV__) console.log('[Workout Draft] typing (no state write)', { setId: set.id, field: 'weight', draft: text });
                                            }}
                                            onFocus={() => {
                                              scrollToSetRow(exerciseIndex, setIndex);
                                              if (__DEV__) console.log('[Workout Input] focus input', { setId: set.id, field: 'weight', currentDraft: editingCellValue });
                                            }}
                                            onBlur={() => commitActiveFieldIfNeeded('blur')}
                                            onEndEditing={() => { }}
                                            autoFocus
                                            keyboardType="decimal-pad"
                                            placeholder="—"
                                            multiline={false}
                                            maxLength={5}
                                            containerStyle={styles.setInputCellInner}
                                            style={[
                                              styles.setInputTextVisible,
                                              styles.setInputFixedDimensions,
                                              { color: colors.primaryLight, backgroundColor: 'transparent' },
                                            ]}
                                            placeholderTextColor={colors.primaryLight + '50'}
                                            selectionColor={colors.primaryLight + '60'}
                                            textAlignVertical="center"
                                          />
                                        </View>
                                      ) : (
                                        <Pressable
                                          onPressIn={playIn}
                                          onPressOut={playOut}
                                          onPress={() => {
                                            const displayValue = set.weight > 0 ? formatWeightDisplay(toDisplayWeight(set.weight, weightUnit), weightUnit) : '';
                                            setEditingCell({ exerciseIndex, setIndex, field: 'weight' });
                                            setEditingCellValue(displayValue);
                                            if (__DEV__) console.log('[Workout Input] start edit', { setId: set.id, field: 'weight', draft: displayValue, displayValue });
                                          }}
                                          style={[styles.setInputPlaceholder, { backgroundColor: colors.primaryLight + '0A' }]}
                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                          <Text style={[styles.setInputPlaceholderText, set.weight > 0 ? { color: colors.primaryLight } : { color: colors.primaryLight + '40' }]}>
                                            {set.weight > 0 ? formatWeightDisplay(toDisplayWeight(set.weight, weightUnit), weightUnit) : '—'}
                                          </Text>
                                        </Pressable>
                                      )}
                                    </View>
                                  </View>

                                  <View style={[styles.setTableCell, styles.setInputCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.reps, zIndex: 1 }]}>
                                    <View style={styles.setCellContentCenter}>
                                      {editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'reps' ? (
                                        <View
                                          ref={(r) => { focusedInputWrapperRef.current = r; }}
                                          onLayout={(e) => {
                                            if (!__DEV__) return;
                                            const { width, height } = e.nativeEvent.layout;
                                            console.log('[Workout Input UI] focus cell', { setId: set.id, field: 'reps', width, height });
                                          }}
                                          style={[
                                            styles.setInputCellBase,
                                            { borderColor: colors.primaryLight + '25', backgroundColor: colors.primaryLight + '08' },
                                            styles.setInputCellActiveVisual,
                                            { borderColor: colors.primaryLight + '45', backgroundColor: colors.primaryLight + '12' },
                                          ]}
                                          collapsable={false}
                                        >
                                          <Input
                                            value={editingCellValue}
                                            onChangeText={(text) => {
                                              setEditingCellValue(text);
                                              if (__DEV__) console.log('[Workout Draft] typing (no state write)', { setId: set.id, field: 'reps', draft: text });
                                            }}
                                            onFocus={() => {
                                              scrollToSetRow(exerciseIndex, setIndex);
                                              if (__DEV__) console.log('[Workout Input] focus input', { setId: set.id, field: 'reps', currentDraft: editingCellValue });
                                            }}
                                            onBlur={() => commitActiveFieldIfNeeded('blur')}
                                            onEndEditing={() => { }}
                                            autoFocus
                                            keyboardType="number-pad"
                                            placeholder="—"
                                            multiline={false}
                                            maxLength={4}
                                            containerStyle={styles.setInputCellInner}
                                            style={[
                                              styles.setInputTextVisible,
                                              styles.setInputFixedDimensions,
                                              { color: colors.primaryLight, backgroundColor: 'transparent' },
                                            ]}
                                            placeholderTextColor={colors.primaryLight + '50'}
                                            selectionColor={colors.primaryLight + '60'}
                                            textAlignVertical="center"
                                          />
                                        </View>
                                      ) : (
                                        <Pressable
                                          onPressIn={playIn}
                                          onPressOut={playOut}
                                          onPress={() => {
                                            const displayValue = set.reps > 0 ? String(set.reps) : '';
                                            setEditingCell({ exerciseIndex, setIndex, field: 'reps' });
                                            setEditingCellValue(displayValue);
                                            if (__DEV__) console.log('[Workout Input] start edit', { setId: set.id, field: 'reps', draft: displayValue, displayValue });
                                          }}
                                          style={[styles.setInputPlaceholder, { backgroundColor: colors.primaryLight + '0A' }]}
                                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                          <Text style={[styles.setInputPlaceholderText, set.reps > 0 ? { color: colors.primaryLight } : { color: colors.primaryLight + '40' }]}>
                                            {set.reps > 0 ? String(set.reps) : '—'}
                                          </Text>
                                        </Pressable>
                                      )}
                                    </View>
                                  </View>

                                  <View style={[styles.setTableCell, styles.setTableCellFlex, { flex: SET_TABLE_FLEX.check }]}>
                                    <View style={styles.setCellContentCenter}>
                                      <Pressable
                                        style={[styles.setCheckWrap, { borderColor: colors.primaryLight + '30' }, isCompleted && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }]}
                                        onPressIn={() => {
                                          playIn();
                                          setPressedCheckRowKey(rowKey);
                                        }}
                                        onPressOut={() => {
                                          playOut();
                                          setPressedCheckRowKey(null);
                                        }}
                                        onPress={() => {
                                          const nextCompleted = !set.completed;
                                          const isEditingThisSet =
                                            editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex;
                                          if (isEditingThisSet && editingCell) {
                                            const { field } = editingCell;
                                            if (field === 'weight') {
                                              const n = parseNumericInput(editingCellValue, 'float');
                                              if (n !== null) {
                                                updateSet(exerciseIndex, setIndex, { weight: n, completed: nextCompleted });
                                              } else {
                                                updateSet(exerciseIndex, setIndex, { completed: nextCompleted });
                                              }
                                            } else {
                                              const n = parseNumericInput(editingCellValue, 'int');
                                              if (n !== null) {
                                                updateSet(exerciseIndex, setIndex, { reps: n, completed: nextCompleted });
                                              } else {
                                                updateSet(exerciseIndex, setIndex, { completed: nextCompleted });
                                              }
                                            }
                                            setEditingCell(null);
                                            setEditingCellValue('');
                                            Keyboard.dismiss();
                                          } else {
                                            updateSet(exerciseIndex, setIndex, { completed: nextCompleted });
                                          }
                                          if (nextCompleted === true) {
                                            if (exercise.restTimer) {
                                              startRestTimer(exercise.restTimer, setIndex, exerciseIndex, set.id);
                                            }
                                          } else {
                                            skipRestTimer(set.id);
                                          }
                                        }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                      >
                                        <Ionicons
                                          name="checkmark"
                                          size={24}
                                          color={isCompleted ? colors.primaryDark : colors.primaryLight + '40'}
                                        />
                                      </Pressable>
                                    </View>
                                  </View>
                                </View>
                              </View>
                            </Swipeable>

                            {/* Note affordance / preview row */}
                            <View style={styles.setNoteRowOuter}>
                              {!set.notes ? (
                                <Pressable
                                  style={styles.setNoteRow}
                                  onPress={() => openSetNotesModal(exerciseIndex, setIndex)}
                                  hitSlop={8}
                                >
                                  <Text style={[styles.setNoteText, { color: colors.primaryLight + '40' }]}>+ note</Text>
                                </Pressable>
                              ) : (
                                <AnimatedSetNote
                                  notes={set.notes}
                                  isExpanded={!!expandedSetNotes[set.id]}
                                  onToggle={() => setExpandedSetNotes(prev => ({ ...prev, [set.id]: !prev[set.id] }))}
                                  onEdit={() => openSetNotesModal(exerciseIndex, setIndex)}
                                />
                              )}
                            </View>
                          </View>
                        );
                      })}

                      {/* Add set button */}
                      <Pressable
                        style={({ pressed }) => [styles.addSetButtonBlock, { backgroundColor: colors.primaryLight + '15' }, pressed && { opacity: 0.85 }]}
                        onPressIn={playIn}
                        onPressOut={playOut}
                        onPress={() => addSet(exerciseIndex)}
                      >
                        <Text style={[styles.addSetButtonBlockText, { color: colors.primaryLight + '90' }]}>+ Add Set</Text>
                      </Pressable>
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
          {/* Confirm pill above keyboard — same bubble UI as profile sheet / tab bar pills */}
          {editingCell && (
            <View style={[styles.keyboardConfirmBar, { bottom: keyboardHeight }]}>
              <Pressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={confirmEditingCell}
                style={styles.keyboardConfirmPillTouchable}
                hitSlop={8}
              >
                <View style={styles.keyboardConfirmPill}>
                  <LinearGradient
                    colors={colors.tabBarBorder as [string, string]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 24 }]}
                  />
                  <View style={[styles.keyboardConfirmPillShell, { backgroundColor: (colors.tabBarFill as [string, string])[1] }]}>
                    <View style={styles.keyboardConfirmPillInner}>
                      <Ionicons name="checkmark" size={24} color={colors.primaryLight} />
                    </View>
                  </View>
                </View>
              </Pressable>
            </View>
          )}
        </AnimatedReanimated.View>
      )}

      {activeWorkout && restTimeEditExerciseIndex !== null && (
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

      {activeWorkout && exerciseMenuIndex !== null && (
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

      {activeWorkout && (
        <ExercisePickerModal
          visible={showExercisePicker}
          onClose={() => {
            setShowExercisePicker(false);
            setReplaceExerciseIndex(null);
          }}
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
        />
      )}

      {/* Set/Exercise Notes Modal — Bottom Sheet Style */}
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
                  placeholder={editingNotes?.setIndex !== undefined ? "Add notes for this set..." : "Add notes for this exercise..."}
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    overflow: 'visible',
  },
  scrollViewLayer: {
    zIndex: 2,
  },
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
  // (old split/routine/bubble styles removed – replaced by Hevy-style components)
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  pageHeaderLeft: {
    width: SETTINGS_CIRCLE_SIZE,
    zIndex: 1,
  },
  pageHeaderTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  pageHeading: {
    fontSize: Typography.h2 * 1.2 * 1.1,
    fontWeight: '600',
    lineHeight: 36,
    marginTop: -4,
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    textAlign: 'center',
  },
  exploreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    zIndex: 1,
  },
  exploreHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  exploreHeaderIconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreHeaderSpacer: {
    flex: 1,
  },
  exploreFeedList: {
    flex: 1,
  },
  feedPostCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  feedPostMedia: {
    width: '100%',
    aspectRatio: 1,
  },
  feedPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  feedPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  feedPostAvatarText: {
    fontSize: Typography.body,
    fontWeight: '600',
  },
  feedPostMeta: {
    flex: 1,
    minWidth: 0,
  },
  feedPostAuthor: {
    fontSize: Typography.body,
    fontWeight: '600',
    letterSpacing: -0.11,
  },
  feedPostHandle: {
    fontSize: Typography.label,
    marginTop: 2,
  },
  feedPostCaption: {
    fontSize: Typography.body,
    fontWeight: '400',
    letterSpacing: -0.11,
    lineHeight: 22,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  feedPostFooter: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  feedPostStats: {
    fontSize: Typography.label,
  },
  feedSuggestedBlock: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  feedSuggestedTitle: {
    fontSize: Typography.body,
    fontWeight: '600',
    letterSpacing: -0.11,
    marginBottom: Spacing.sm,
  },
  feedSuggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  feedSuggestedMeta: {
    flex: 1,
    minWidth: 0,
    marginLeft: Spacing.sm,
  },
  feedSuggestedAvatar: {
    marginRight: 0,
  },
  feedFollowButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  feedFollowButtonText: {
    fontSize: Typography.label,
    fontWeight: '600',
  },
  notificationsBackRowModal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationsPopupContent: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    top: 54,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.primaryDarkLighter,
    maxHeight: '80%',
  },
  notificationsPopupInner: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  notificationsPopupTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    marginBottom: Spacing.md,
  },
  notificationsScroll: {
    flex: 1,
  },
  notificationsScrollContent: {
    paddingBottom: Spacing.lg,
  },
  notificationsSectionLabel: {
    fontSize: Typography.label,
    fontWeight: '600',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
  },
  notificationAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  notificationAvatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  notificationCenter: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  notificationText: {
    fontSize: Typography.body,
    fontWeight: '400',
  },
  notificationTextBold: {
    fontWeight: '600',
  },
  notificationSecondary: {
    fontSize: Typography.label,
    marginTop: 2,
  },
  notificationThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginLeft: Spacing.sm,
  },
  mainMenuButton: {
    width: BUTTON_WIDTH,
    height: MAIN_MENU_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    marginVertical: 0,
  },
  cardTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  workoutHomeContent: { flex: 1, paddingBottom: Spacing.xl },
  workoutHomeTitle: { fontSize: Typography.h2, fontWeight: '600', marginBottom: Spacing.xl },
  workoutHomeButton: {
    width: '100%',
    maxWidth: BUTTON_WIDTH,
    height: MAIN_MENU_BUTTON_HEIGHT,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MAIN_MENU_BUTTON_GAP,
  },
  workoutHomeButtonText: { fontSize: Typography.body, fontWeight: '600' },
  // (history modal styles moved to WorkoutProgressWidget)
  // ─── HEVY-STYLE LOG WORKOUT LAYOUT ──────────────────────────────────────────
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

  // ─── HEVY-STYLE SUMMARY STATS ─────────────────────────────────────────────
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

  // ─── HEVY-STYLE REST TIMER PANEL ──────────────────────────────────────────
  /** Outer animated wrapper — overflow visible so the translateY slide doesn't clip content. */
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
  /** Replaces the old restTimerHeader — keeps the same 8px bottom margin for the label row. */
  restTimerRow: {
    marginBottom: 8,
  },
  restTimerHeader: {
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

  // ─── HEVY-STYLE EXERCISE BLOCKS ───────────────────────────────────────────
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

  // ─── Exercise menu popup (replace/delete) – workout tracker card + buttons ─
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

  // ─── SET TABLE (flex: set 0.85, previous 1.0, weight 0.95, reps 0.95, check 0.65) ─
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
    width: '100%',
  },
  setTableCell: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTableCellFlex: {
    minWidth: 0,
  },
  setTableHeaderLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    letterSpacing: 0,
    color: Colors.primaryLight + '50',
    textAlign: 'center',
    textTransform: 'uppercase' as const,
  },
  setInputCell: {
    paddingHorizontal: 2,
  },
  setCellContentCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  keyboardConfirmBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingRight: 20,
    paddingLeft: 20,
  },
  keyboardConfirmPillTouchable: {
    width: 52,
    height: 48,
  },
  keyboardConfirmPill: {
    width: 52,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  keyboardConfirmPillShell: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 23,
    overflow: 'hidden',
  },
  keyboardConfirmPillInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── SET ROWS (same flex as header, tight padding so check fits) ─────────────
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    width: '100%',
  },
  setRowCompleted: {
    backgroundColor: Colors.primaryLight + '0A',
    borderColor: Colors.primaryLight + '20',
  },
  setDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDotCompleted: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  setPreviousTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setInputTextVisible: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primaryLight,
    textAlign: 'center',
    letterSpacing: -0.11,
    lineHeight: 16,
    width: '100%',
    paddingVertical: 0,
  },
  setDotText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primaryLight + '80',
    letterSpacing: -0.11,
  },
  setDotTextCompleted: {
    color: Colors.primaryDark,
  },
  setCellDim: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.primaryLight + '50',
    letterSpacing: -0.11,
    textAlign: 'center',
  },
  setCellDimCompleted: {
    color: Colors.primaryLight + '70',
  },
  /** All sizing/layout for set row input cell – shared by wrapper and inner. No colors. */
  setInputCellBase: {
    marginBottom: 0,
    minHeight: SET_INPUT_PILL_HEIGHT,
    height: SET_INPUT_PILL_HEIGHT,
    maxHeight: SET_INPUT_PILL_HEIGHT,
    width: '84%',
    maxWidth: SET_INPUT_MAX_WIDTH,
    minWidth: SET_INPUT_MIN_WIDTH,
    alignSelf: 'center' as const,
    borderRadius: SET_INPUT_BORDER_RADIUS,
    borderWidth: SET_INPUT_BORDER_WIDTH,
  },
  /** Active state: visual only (no size change). Use with theme borderColor/backgroundColor. */
  setInputCellActiveVisual: {
    shadowColor: Colors.primaryLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 0,
  },
  /** Input container: same size as base, no border/background so only wrapper draws focus. */
  setInputCellInner: {
    marginBottom: 0,
    minHeight: SET_INPUT_PILL_HEIGHT,
    height: SET_INPUT_PILL_HEIGHT,
    maxHeight: SET_INPUT_PILL_HEIGHT,
    width: '84%',
    maxWidth: SET_INPUT_MAX_WIDTH,
    minWidth: SET_INPUT_MIN_WIDTH,
    alignSelf: 'center' as const,
    borderRadius: SET_INPUT_BORDER_RADIUS,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  setInputFixedDimensions: {
    height: SET_INPUT_PILL_HEIGHT,
    minHeight: SET_INPUT_PILL_HEIGHT,
    maxHeight: SET_INPUT_PILL_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: SET_INPUT_PADDING_H,
    borderWidth: 0,
    borderRadius: SET_INPUT_BORDER_RADIUS,
  },
  setInputText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primaryLight,
    textAlign: 'center',
    letterSpacing: -0.11,
  },
  setInputTextCompleted: {
    color: Colors.white,
  },
  setInputPlaceholder: {
    height: SET_INPUT_PILL_HEIGHT,
    width: '84%',
    maxWidth: SET_INPUT_MAX_WIDTH,
    minWidth: SET_INPUT_MIN_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight + '0A',
    borderRadius: SET_INPUT_BORDER_RADIUS,
    paddingHorizontal: SET_INPUT_PADDING_H,
  },
  setInputPlaceholderText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primaryLight + '40',
    letterSpacing: -0.11,
  },
  setCheckWrap: {
    width: SET_CHECK_BUTTON_SIZE,
    height: SET_CHECK_BUTTON_SIZE,
    borderRadius: SET_CHECK_BUTTON_SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.primaryLight + '30',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCheckWrapCompleted: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  setCheckText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primaryLight + '40',
    letterSpacing: -0.11,
  },
  setCheckTextCompleted: {
    color: Colors.primaryDark,
  },
  setRowDeleteAction: {
    backgroundColor: Colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginLeft: 4,
  },
  setRowDeleteText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: -0.11,
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
  // Set-level notes styles
  setBlock: {
    marginBottom: 6,
  },
  setRowWrapper: {
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  setDotPressable: {
    alignItems: 'center',
    gap: 2,
  },
  setNoteRowOuter: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  setNoteRowInner: {
    width: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(198,198,198,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.10)',
  },
  setNoteRow: {
    width: '92%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(198,198,198,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNoteText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.primaryLight + 'D9', // ~85% opacity
    letterSpacing: -0.11,
    lineHeight: 12 * 1.25,
  },
  setNoteTextExpanded: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.primaryLight + 'D9',
    letterSpacing: -0.11,
    lineHeight: 12 * 1.3,
    paddingBottom: 2,
  },
  setNoteFadeHint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.primaryLight + '66', // ~40% opacity
    letterSpacing: -0.11,
  },
  setNoteEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight + '10',
  },
  setNoteEditButtonText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primaryLight + '99',
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
