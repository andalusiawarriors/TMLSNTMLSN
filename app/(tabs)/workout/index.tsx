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
  NativeSyntheticEvent,
  NativeScrollEvent,
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
} from '../../../utils/storage';
import { logStreakWorkout } from '../../../utils/streak';
import { WorkoutSession, Exercise, Set, WorkoutSplit, SavedRoutine } from '../../../types';
import { generateId, formatDuration } from '../../../utils/helpers';
import { scheduleRestTimerNotification } from '../../../utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useButtonSound } from '../../../hooks/useButtonSound';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { Card } from '../../../components/Card';
import { ExercisePickerModal } from '../../../components/ExercisePickerModal';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';
import { useTheme } from '../../../context/ThemeContext';
import { useActiveWorkout } from '../../../context/ActiveWorkoutContext';
import { SlidersHorizontal } from 'phosphor-react-native';
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

export type WorkoutScreenModalProps = {
  asModal?: boolean;
  initialActiveWorkout?: WorkoutSession | null;
  onCloseModal?: () => void;
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

  // Rest Timer State
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [restTimerNotificationId, setRestTimerNotificationId] = useState<string | null>(null);

  // Exercise Entry State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [editingCell, setEditingCell] = useState<{
    exerciseIndex: number;
    setIndex: number;
    field: 'weight' | 'reps';
  } | null>(null);

  const { playIn, playOut } = useButtonSound();


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
    }, [])
  );

  const lastProcessedStartEmpty = useRef(false);
  const lastProcessedSplitId = useRef<string | null>(null);
  const lastProcessedRoutineId = useRef<string | null>(null);
  const activeWorkoutRef = useRef<WorkoutSession | null>(null);
  useEffect(() => {
    activeWorkoutRef.current = activeWorkout;
  }, [activeWorkout]);
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
      getSavedRoutines().then((routines) => {
        const routine = routines.find((r) => r.id === startRoutineId);
        if (routine) {
          lastProcessedRoutineId.current = startRoutineId;
          startWorkoutFromSavedRoutine(routine);
          router.setParams({});
        }
      });
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

  const startWorkoutFromSavedRoutine = (routine: SavedRoutine) => {
    const exercises: Exercise[] = routine.exercises.map((ex) => ({
      id: generateId(),
      name: ex.name,
      sets: [],
      restTimer: ex.restTimer,
      exerciseDbId: ex.exerciseDbId,
    }));

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
    if (__DEV__) {
      console.log('[Workout UI] added exercise:', newExercise);
    }

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

  const updateSet = (exerciseIndex: number, setIndex: number, updates: { weight?: number; reps?: number; completed?: boolean }) => {
    if (!activeWorkout) return;
    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise || !exercise.sets[setIndex]) return;

    const updatedSets = [...exercise.sets];
    updatedSets[setIndex] = {
      ...updatedSets[setIndex],
      ...(updates.weight !== undefined && { weight: updates.weight }),
      ...(updates.reps !== undefined && { reps: updates.reps }),
      ...(updates.completed !== undefined && { completed: updates.completed }),
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

  const updateExerciseRestTimer = (exerciseIndex: number, restTimer: number) => {
    if (!activeWorkout) return;
    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise) return;
    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[exerciseIndex] = { ...exercise, restTimer };
    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const startRestTimer = async (seconds: number, setNumber: number, exerciseIdx?: number) => {
    setRestTimeRemaining(seconds);
    setRestTimerActive(true);
    const idx = exerciseIdx ?? currentExerciseIndex;
    try {
      const exerciseName = activeWorkout?.exercises[idx]?.name || 'Exercise';
      const notificationId = await scheduleRestTimerNotification(
        exerciseName,
        setNumber + 1,
        seconds
      );
      setRestTimerNotificationId(notificationId);
    } catch (error) {
      console.error('Failed to schedule rest timer notification:', error);
    }
  };

  const skipRestTimer = () => {
    setRestTimerActive(false);
    setRestTimeRemaining(0);
    if (restTimerNotificationId) {
      // Cancel the notification (would need to implement cancelNotification)
      setRestTimerNotificationId(null);
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
        if (__DEV__) {
          console.log('[Workout UI] blocked empty save:', {
            sessionId: payload.id,
            totalExercises,
            totalSets,
            completedSets,
            duration: payload.duration,
          });
        }
        Alert.alert('No workout data', 'Add at least one completed set before saving.');
        return;
      }

      if (__DEV__) {
        console.log('[Workout UI] save pressed');
        console.log('[Workout UI] payload summary:', {
          sessionId: payload.id,
          exercisesCount: totalExercises,
          totalSets,
          duration: payload.duration,
          isSavingWorkout,
        });
      }

      await saveWorkoutSession(payload);
      await logStreakWorkout();

      setActiveWorkout(null);
      setShowExerciseEntry(false);
      setCurrentExerciseIndex(0);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success!', 'Workout saved successfully', [
        { text: 'OK', onPress: () => onCloseModal?.() },
      ]);
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

  const totalSets = activeWorkout?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0) ?? 0;
  const totalVolume = activeWorkout?.exercises.reduce(
    (acc, ex) => acc + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0),
    0
  ) ?? 0;

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
      <HomeGradientBackground />
      {/* Main menu – hidden when asModal (FAB opened from another tab); only overlay is shown */}
      {!asModal && (
      <>
      <ScrollView
        style={styles.scrollViewLayer}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: TOP_LEFT_PILL_TOP,
            paddingBottom: Math.max(Spacing.md, insets.bottom + 100),
          },
        ]}
      >
        {/* Header: profile + tmlsn tracker. + settings */}
        <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
        <View style={styles.pageHeaderRow}>
          <View style={styles.pageHeaderLeft} />
          <View style={styles.pageHeaderTitleWrap} pointerEvents="box-none">
            <Text style={[styles.pageHeading, { color: colors.primaryLight }]}>tmlsn tracker.</Text>
          </View>
          <View style={styles.pageHeaderRight}>
          <Pressable
            style={styles.settingsButton}
            onPressIn={playIn}
            onPressOut={playOut}
            onPress={() => router.push('/workout/settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={styles.settingsPill}>
              <LinearGradient
                colors={colors.pillBorderGradient}
                style={[StyleSheet.absoluteFillObject, { borderRadius: SETTINGS_CIRCLE_SIZE / 2 }]}
              />
              <LinearGradient
                colors={colors.pillFillGradient}
                style={[
                  StyleSheet.absoluteFillObject,
                  { top: 1, left: 1, right: 1, bottom: 1, borderRadius: SETTINGS_CIRCLE_SIZE / 2 - 1 },
                ]}
              />
              <SlidersHorizontal size={20} color={colors.primaryLight} weight="regular" />
            </View>
          </Pressable>
          </View>
        </View>
        </AnimatedFadeInUp>

        {/* Achievements – progress widget moved to profile (progress tab, Fitness toggle) */}
        <AnimatedFadeInUp delay={320} duration={380} trigger={animTrigger}>
        <View style={styles.achievementsStack}>
          <AnimatedPressable style={styles.achievementCardWrap}>
            <Card gradientFill borderRadius={38} style={styles.achievementCard}>
              <Text style={[styles.mainMenuButtonText, { color: colors.cardIconTint }]}>achievements</Text>
            </Card>
          </AnimatedPressable>
        </View>
        </AnimatedFadeInUp>

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
          <ScrollView
            contentContainerStyle={[
              styles.contentContainer,
              { paddingTop: TOP_LEFT_PILL_TOP, paddingBottom: Math.max(Spacing.md, insets.bottom + 100) },
            ]}
          >
            {/* ─── HEVY-STYLE TOP BAR ─── */}
            <AnimatedFadeInUp delay={0} duration={280} trigger={overlayTrigger} instant>
            <View style={styles.logTopBar}>
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
              <View style={styles.logTopCenter}>
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

            {/* ─── HEVY-STYLE SUMMARY STATS ROW ─── */}
            <AnimatedFadeInUp delay={50} duration={300} trigger={overlayTrigger} instant>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}>
                <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>⚖</Text>
                <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{totalVolume.toLocaleString()}</Text>
                <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>{weightUnit}</Text>
              </View>
              <View style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}>
                <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>◉</Text>
                <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{totalSets}</Text>
                <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>sets</Text>
              </View>
              <View style={[styles.summaryStatPill, { backgroundColor: colors.primaryLight + '12' }]}>
                <Text style={[styles.summaryStatIcon, { color: colors.primaryLight + '80' }]}>◎</Text>
                <Text style={[styles.summaryStatValue, { color: colors.primaryLight }]}>{activeWorkout.exercises.length}</Text>
                <Text style={[styles.summaryStatUnit, { color: colors.primaryLight + '80' }]}>exercises</Text>
              </View>
            </View>
            </AnimatedFadeInUp>

            {/* ─── HEVY-STYLE REST TIMER PANEL ─── */}
            {restTimerActive && restTimeRemaining > 0 && (
              <AnimatedFadeInUp delay={80} duration={300} trigger={overlayTrigger} instant>
              <View style={[styles.restTimerPanel, { backgroundColor: colors.primaryLight + '08', borderColor: colors.primaryLight + '20' }]}>
                <View style={styles.restTimerHeader}>
                  <Text style={[styles.restTimerLabel, { color: colors.primaryLight + '80' }]}>REST TIMER</Text>
                </View>
                <Text style={[styles.restTimerCountdown, { color: colors.primaryLight }]}>{formatDuration(restTimeRemaining)}</Text>
                <View style={[styles.restTimerProgressTrack, { backgroundColor: colors.primaryLight + '15' }]}>
                  <View style={[styles.restTimerProgressFill, { backgroundColor: colors.primaryLight, width: `${Math.max(0, (restTimeRemaining / (activeWorkout.exercises[currentExerciseIndex]?.restTimer || 120)) * 100)}%` }]} />
                </View>
                <View style={styles.restTimerButtonsRow}>
                  <AnimatedPressable
                    style={[styles.restTimerAdjustButton, { backgroundColor: colors.primaryLight + '15' }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={() => setRestTimeRemaining((prev) => Math.max(0, prev - 15))}
                  >
                    <Text style={[styles.restTimerAdjustButtonText, { color: colors.primaryLight }]}>−15s</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={[styles.restTimerSkipButton, { backgroundColor: colors.primaryLight }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={skipRestTimer}
                  >
                    <Text style={[styles.restTimerSkipButtonText, { color: colors.primaryDark }]}>Skip</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={[styles.restTimerAdjustButton, { backgroundColor: colors.primaryLight + '15' }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={() => setRestTimeRemaining((prev) => prev + 15)}
                  >
                    <Text style={[styles.restTimerAdjustButtonText, { color: colors.primaryLight }]}>+15s</Text>
                  </AnimatedPressable>
                </View>
              </View>
              </AnimatedFadeInUp>
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
              <View style={[styles.exerciseBlock, { backgroundColor: colors.primaryLight + '08', borderColor: colors.primaryLight + '15' }]}>
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
                <Text style={[styles.notesPlaceholder, { color: colors.primaryLight + '50' }]}>+ Add notes</Text>

                {/* Set table header */}
                <View style={styles.setTableHeader}>
                  <Text style={[styles.setTableHeaderCell, { width: 36, color: colors.primaryLight + '50' }]}>SET</Text>
                  <Text style={[styles.setTableHeaderCell, { flex: 1, color: colors.primaryLight + '50' }]}>PREVIOUS</Text>
                  <Text style={[styles.setTableHeaderCell, { width: 72, color: colors.primaryLight + '50' }]}>{weightUnit.toUpperCase()}</Text>
                  <Text style={[styles.setTableHeaderCell, { width: 56, color: colors.primaryLight + '50' }]}>REPS</Text>
                  <Text style={[styles.setTableHeaderCell, { width: 36, color: colors.primaryLight + '50' }]}>✓</Text>
                </View>

                {/* Set rows – Hevy style */}
                {exercise.sets.map((set, setIndex) => {
                  const isCompleted = set.completed;
                  return (
                    <Swipeable
                      key={set.id}
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
                      <View style={[styles.setRow, isCompleted && { backgroundColor: colors.primaryLight + '0A', borderColor: colors.primaryLight + '20' }]}>
                        {/* Set number dot */}
                        <View style={[styles.setDot, { borderColor: colors.primaryLight + '30' }, isCompleted && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }]}>
                          <Text style={[styles.setDotText, { color: colors.primaryLight + '80' }, isCompleted && { color: colors.primaryDark }]}>
                            {setIndex + 1}
                          </Text>
                        </View>

                        {/* Previous */}
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          <Text style={[styles.setCellDim, { color: colors.primaryLight + '50' }, isCompleted && { color: colors.primaryLight + '70' }]}>
                            {setIndex > 0 && exercise.sets[setIndex - 1].weight > 0
                              ? `${exercise.sets[setIndex - 1].weight}×${exercise.sets[setIndex - 1].reps}`
                              : '—'}
                          </Text>
                        </View>

                        {/* Weight input */}
                        <View style={{ width: 72, alignItems: 'center' }}>
                          {(set.weight > 0 || (editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'weight')) ? (
                            <Input
                              value={String(set.weight)}
                              onChangeText={(text) => updateSet(exerciseIndex, setIndex, { weight: parseFloat(text) || 0 })}
                              onBlur={() => setEditingCell(null)}
                              autoFocus={editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'weight'}
                              keyboardType="numeric"
                              placeholder="—"
                              containerStyle={styles.setInputContainer}
                              style={[styles.setInputText, { color: colors.primaryLight }, isCompleted && { color: colors.primaryDark }]}
                              placeholderTextColor={colors.primaryLight + '60'}
                            />
                          ) : (
                            <Pressable
                              onPressIn={playIn}
                              onPressOut={playOut}
                              onPress={() => setEditingCell({ exerciseIndex, setIndex, field: 'weight' })}
                              style={[styles.setInputPlaceholder, { backgroundColor: colors.primaryLight + '0A' }]}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={[styles.setInputPlaceholderText, { color: colors.primaryLight + '40' }]}>—</Text>
                            </Pressable>
                          )}
                        </View>

                        {/* Reps input */}
                        <View style={{ width: 56, alignItems: 'center' }}>
                          {(set.reps > 0 || (editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'reps')) ? (
                            <Input
                              value={String(set.reps)}
                              onChangeText={(text) => updateSet(exerciseIndex, setIndex, { reps: parseInt(text, 10) || 0 })}
                              onBlur={() => setEditingCell(null)}
                              autoFocus={editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'reps'}
                              keyboardType="numeric"
                              placeholder="—"
                              containerStyle={styles.setInputContainer}
                              style={[styles.setInputText, { color: colors.primaryLight }, isCompleted && { color: colors.primaryDark }]}
                              placeholderTextColor={colors.primaryLight + '60'}
                            />
                          ) : (
                            <Pressable
                              onPressIn={playIn}
                              onPressOut={playOut}
                              onPress={() => setEditingCell({ exerciseIndex, setIndex, field: 'reps' })}
                              style={[styles.setInputPlaceholder, { backgroundColor: colors.primaryLight + '0A' }]}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={[styles.setInputPlaceholderText, { color: colors.primaryLight + '40' }]}>—</Text>
                            </Pressable>
                          )}
                        </View>

                        {/* Completion checkmark */}
                        <Pressable
                          style={[styles.setCheckWrap, { borderColor: colors.primaryLight + '30' }, isCompleted && { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight }]}
                          onPressIn={playIn}
                          onPressOut={playOut}
                          onPress={() => {
                            updateSet(exerciseIndex, setIndex, { completed: !set.completed });
                            if (!set.completed && exercise.restTimer) {
                              startRestTimer(exercise.restTimer, setIndex, exerciseIndex);
                            }
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.setCheckText, { color: colors.primaryLight + '40' }, isCompleted && { color: colors.primaryDark }]}>✓</Text>
                        </Pressable>
                      </View>
                    </Swipeable>
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
          </ScrollView>
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
          <Pressable style={styles.exerciseMenuOverlay} onPress={closeExerciseMenu}>
            <Pressable style={[styles.exerciseMenuCard, { backgroundColor: colors.primaryDark, borderColor: colors.primaryLight + '20' }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.exerciseMenuTitle, { color: colors.primaryLight }]} numberOfLines={1}>
                {activeWorkout.exercises[exerciseMenuIndex]?.name ?? 'Exercise'}
              </Text>
              <TouchableOpacity
                style={[styles.exerciseMenuOption, { backgroundColor: colors.primaryDarkLighter }]}
                onPress={handleReplaceFromMenu}
                activeOpacity={0.7}
              >
                <Text style={[styles.exerciseMenuOptionText, { color: colors.primaryLight }]}>Replace exercise</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exerciseMenuOption, { backgroundColor: colors.primaryDarkLighter }]}
                onPress={handleDeleteFromMenu}
                activeOpacity={0.7}
              >
                <Text style={[styles.exerciseMenuOptionText, styles.exerciseMenuOptionDestructive, { color: colors.accentRed }]}>
                  Delete exercise
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exerciseMenuOption, styles.exerciseMenuOptionCancel]}
                onPress={closeExerciseMenu}
                activeOpacity={0.7}
              >
                <Text style={[styles.exerciseMenuOptionText, { color: colors.primaryLight }]}>Cancel</Text>
              </TouchableOpacity>
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
              if (__DEV__) {
                console.log('[Workout UI] added exercise (replace):', newEx);
              }
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
  settingsButton: {
    width: SETTINGS_CIRCLE_SIZE,
    height: SETTINGS_CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsPill: {
    width: SETTINGS_CIRCLE_SIZE,
    height: SETTINGS_CIRCLE_SIZE,
    borderRadius: SETTINGS_CIRCLE_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  mainMenuButton: {
    width: BUTTON_WIDTH,
    height: MAIN_MENU_BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    marginVertical: 0,
  },
  mainMenuButtonText: {
    fontSize: Typography.promptText,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: -0.11,
    color: '#C6C6C6',
    textAlign: 'center',
  },
  achievementsStack: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: MAIN_MENU_BUTTON_GAP,
    marginBottom: Spacing.sm,
  },
  achievementCardWrap: {
    alignSelf: 'center',
  },
  achievementCard: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    alignSelf: 'center',
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
  // (history modal styles moved to WorkoutProgressWidget)
  // ─── HEVY-STYLE LOG WORKOUT LAYOUT ──────────────────────────────────────────
  logTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  logTopCenter: {
    flex: 1,
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
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
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

  // ─── Exercise menu popup (replace/delete) – TMLSN design ───────────────────
  exerciseMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  exerciseMenuCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '20',
    padding: Spacing.lg,
    ...Shadows.card,
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
  exerciseMenuTitle: {
    fontFamily: Font.semiBold,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '25',
  },
  exerciseMenuOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.primaryDarkLighter,
  },
  exerciseMenuOptionText: {
    fontFamily: Font.monoMedium,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  exerciseMenuOptionDestructive: {
    color: Colors.accentRed,
  },
  exerciseMenuOptionCancel: {
    marginTop: Spacing.sm,
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
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

  // ─── HEVY-STYLE SET TABLE ─────────────────────────────────────────────────
  setTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  setTableHeaderCell: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: -0.11,
    color: Colors.primaryLight + '50',
    textAlign: 'center',
    textTransform: 'uppercase' as const,
  },

  // ─── HEVY-STYLE SET ROWS ──────────────────────────────────────────────────
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
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
    marginRight: 4,
  },
  setDotCompleted: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
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
  },
  setCellDimCompleted: {
    color: Colors.primaryLight + '70',
  },
  setInputContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginBottom: 0,
    minHeight: 32,
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
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight + '0A',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  setInputPlaceholderText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primaryLight + '40',
    letterSpacing: -0.11,
  },
  setCheckWrap: {
    width: 36,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primaryLight + '30',
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
    height: 40,
    backgroundColor: Colors.primaryLight + '15',
    marginTop: 8,
    borderRadius: 12,
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
});
