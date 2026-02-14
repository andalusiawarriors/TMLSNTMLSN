import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  Animated,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../../constants/theme';
import { TMLSN_SPLITS } from '../../../constants/workoutSplits';
import {
  getRecentWorkouts,
  getWorkoutSessions,
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
import { workoutsToSetRecords } from '../../../utils/workoutMuscles';
import { getWeekStart, calculateWeeklyMuscleVolume, calculateHeatmap } from '../../../utils/weeklyMuscleTracker';
import { HeatmapPreviewWidget } from '../../../components/HeatmapPreviewWidget';
import { StatisticsButtonWidget } from '../../../components/StatisticsButtonWidget';
import { StreakWidget } from '../../../components/StreakWidget';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';

// EB Garamond – same as Calorie tab; DB Mono for body/UI text
const Font = {
  regular: 'EBGaramond_400Regular',
  medium: 'EBGaramond_500Medium',
  semiBold: 'EBGaramond_600SemiBold',
  bold: 'EBGaramond_700Bold',
  extraBold: 'EBGaramond_800ExtraBold',
  mono: 'DMMono_400Regular',
} as const;

const HeadingLetterSpacing = -1;

const formatRoutineTitle = (name: string) => {
  const lower = name.toLowerCase();
  const words = lower.split(' ');
  const lastWord = words[words.length - 1];
  if (lastWord.length === 1 && /[a-z]/.test(lastWord)) {
    words[words.length - 1] = lastWord.toUpperCase();
  }
  return words.join(' ');
};
const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_WIDTH = Math.min(380, SCREEN_WIDTH - 40);
const PROGRESS_CARD_WIDTH = Math.min(380, SCREEN_WIDTH - 40);
const MAIN_MENU_BUTTON_HEIGHT = 69;
const MAIN_MENU_BUTTON_GAP = 15;
const PROGRESS_CARD_HEIGHT = 237;
const THREE_BUTTON_STACK_HEIGHT = MAIN_MENU_BUTTON_HEIGHT * 3 + MAIN_MENU_BUTTON_GAP * 3; // 252
const SWIPE_PAGE_HEIGHT = THREE_BUTTON_STACK_HEIGHT; // same height for both pages so y-axis aligns during swipe
const SWIPE_WIDGET_PADDING_TOP = 12;
const SWIPE_WIDGET_EXTRA_HEIGHT = 0;
export default function WorkoutScreen() {
  const router = useRouter();
  const { startSplitId, startRoutineId } = useLocalSearchParams<{
    startSplitId?: string;
    startRoutineId?: string;
  }>();
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSession[]>([]);
  const [weeklyHeatmap, setWeeklyHeatmap] = useState<ReturnType<typeof calculateHeatmap>>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showSplitSelection, setShowSplitSelection] = useState(false);
  const [showExerciseEntry, setShowExerciseEntry] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [swipePageIndex, setSwipePageIndex] = useState(0);
  const [swipeViewWidth, setSwipeViewWidth] = useState(SCREEN_WIDTH);
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

  useEffect(() => {
    loadWorkouts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      getUserSettings().then((s) => setWeightUnit(s.weightUnit));
    }, [])
  );

  const lastProcessedSplitId = useRef<string | null>(null);
  const lastProcessedRoutineId = useRef<string | null>(null);
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

  const loadWorkouts = async () => {
    const workouts = await getRecentWorkouts(10);
    setRecentWorkouts(workouts);
    // Load weekly muscle heatmap
    const allSessions = await getWorkoutSessions();
    const weekStart = getWeekStart();
    const setRecords = workoutsToSetRecords(allSessions, weekStart);
    const weeklyVolume = calculateWeeklyMuscleVolume(setRecords);
    setWeeklyHeatmap(calculateHeatmap(weeklyVolume));
  };

  const startWorkoutFromSplit = (split: WorkoutSplit) => {
    slideAnim.setValue(1);
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
    slideAnim.setValue(1);
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
    slideAnim.setValue(1);
    const newWorkout: WorkoutSession = {
      id: generateId(),
      date: new Date().toISOString(),
      name: 'Freeform Workout',
      exercises: [],
      duration: 0,
      isComplete: false,
    };

    setActiveWorkout(newWorkout);
    setShowSplitSelection(false);
    Alert.prompt(
      'Add Exercise',
      'Enter exercise name',
      (text) => {
        if (text) {
          addExercise(text);
          setShowExerciseEntry(true);
        }
      }
    );
  };

  const addExercise = (exerciseName: string) => {
    if (!activeWorkout) return;

    const newExercise: Exercise = {
      id: generateId(),
      name: exerciseName,
      sets: [],
      restTimer: 120, // default 2 minutes
    };

    setActiveWorkout({
      ...activeWorkout,
      exercises: [...activeWorkout.exercises, newExercise],
    });
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
    if (!activeWorkout) return;

    const duration = Math.round(
      (new Date().getTime() - new Date(activeWorkout.date).getTime()) / 60000
    );

    const completedWorkout: WorkoutSession = {
      ...activeWorkout,
      duration,
      isComplete: true,
    };

    await saveWorkoutSession(completedWorkout);
    await logStreakWorkout();
    await loadWorkouts();

    setActiveWorkout(null);
    setShowExerciseEntry(false);
    setCurrentExerciseIndex(0);
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Success!', 'Workout saved successfully');
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
  };

  const slideAnim = useRef(new Animated.Value(1)).current;
  const windowHeight = Dimensions.get('window').height;
  const PAN_DOWN_DURATION = 280;
  const PAN_UP_DURATION = 350;

  useEffect(() => {
    if (activeWorkout) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: PAN_UP_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [activeWorkout?.id]);

  const runPanDownAnimation = () => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: PAN_DOWN_DURATION,
      useNativeDriver: true,
    }).start(() => {
      goBackToMainMenu();
      // Don't reset slideAnim here – it would flash the overlay back for one frame. Reset when starting next workout.
    });
  };

  const handleBackArrowPress = () => {
    if (!activeWorkout) return;
    const count = activeWorkout.exercises.length;
    const exerciseWord = count === 1 ? 'exercise' : 'exercises';
    Alert.alert(
      'Leave workout?',
      `You have ${count} ${exerciseWord} left. Are you sure you want to leave the workout?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: runPanDownAnimation },
        { text: 'Leave', style: 'destructive', onPress: goBackToMainMenu },
      ]
    );
  };

  const insets = useSafeAreaInsets();
  const contentTopPadding = insets.top + Spacing.sm;

  return (
    <View style={styles.container}>
      {/* Main menu – always present (underneath when workout overlay is shown) */}
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: contentTopPadding,
            paddingBottom: Math.max(Spacing.md, insets.bottom + 100),
          },
        ]}
      >
        {/* Header: profile + tmlsn tracker. + settings */}
        <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
        <View style={styles.pageHeaderRow}>
          <View style={styles.pageHeaderLeft}>
            <StreakWidget />
          </View>
          <View style={styles.pageHeaderTitleWrap} pointerEvents="box-none">
            <Text style={styles.pageHeading}>tmlsn tracker.</Text>
          </View>
          <View style={styles.pageHeaderRight}>
          <Pressable
            style={styles.settingsButton}
            onPressIn={playIn}
            onPressOut={playOut}
            onPress={() => router.push('/workout/settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.settingsButtonText}>⚙</Text>
          </Pressable>
          </View>
        </View>
        </AnimatedFadeInUp>

        {/* Heatmap preview (top, below header) */}
        <AnimatedFadeInUp delay={80} duration={380} trigger={animTrigger}>
          <HeatmapPreviewWidget heatmapData={weeklyHeatmap} />
        </AnimatedFadeInUp>

        {/* Statistics button (pressable, below heatmap) */}
        <AnimatedFadeInUp delay={160} duration={380} trigger={animTrigger}>
          <StatisticsButtonWidget />
        </AnimatedFadeInUp>

        {/* Swipeable widget: full screen width for centered snap */}
        <AnimatedFadeInUp delay={240} duration={380} trigger={animTrigger}>
        <View
          style={styles.swipeWidgetWrapper}
          onLayout={(e) => setSwipeViewWidth(e.nativeEvent.layout.width)}
        >
          <ScrollView
            horizontal
            snapToInterval={swipeViewWidth || SCREEN_WIDTH}
            snapToAlignment="center"
            decelerationRate="fast"
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const w = swipeViewWidth || SCREEN_WIDTH;
              const page = Math.round(e.nativeEvent.contentOffset.x / w);
              setSwipePageIndex(Math.min(page, 1));
            }}
            style={[styles.swipeWidget, { width: swipeViewWidth || SCREEN_WIDTH }]}
            contentContainerStyle={styles.swipeWidgetContent}
          >
            {/* Page 0: 3 buttons */}
            <View style={styles.swipePage}>
              <AnimatedPressable
                style={styles.mainMenuButton}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => router.push('/workout/tmlsn-routines')}
              >
                <Text style={styles.mainMenuButtonText}>tmlsn routines.</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.mainMenuButton}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => router.push('/workout/your-routines')}
              >
                <Text style={styles.mainMenuButtonText}>your routines.</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.mainMenuButton}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={startFreeformWorkout}
              >
                <Text style={styles.mainMenuButtonText}>start empty workout</Text>
              </AnimatedPressable>
            </View>
            {/* Page 1: progress card */}
            <View style={styles.swipePage}>
              <AnimatedPressable
                style={styles.progressCard}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => setShowHistory(true)}
              >
                <Text style={styles.mainMenuButtonText}>progress</Text>
              </AnimatedPressable>
            </View>
          </ScrollView>
          {/* Swipe dots */}
          <View style={styles.swipeDots}>
            <View style={[styles.swipeDot, swipePageIndex === 0 && styles.swipeDotActive]} />
            <View style={[styles.swipeDot, swipePageIndex === 1 && styles.swipeDotActive]} />
          </View>
        </View>
        </AnimatedFadeInUp>

        {/* Achievements only – streak moved to header widget */}
        <AnimatedFadeInUp delay={320} duration={380} trigger={animTrigger}>
        <View style={styles.achievementsStack}>
          <AnimatedPressable style={styles.achievementCard}>
            <Text style={styles.mainMenuButtonText}>achievements</Text>
          </AnimatedPressable>
        </View>
        </AnimatedFadeInUp>

      </ScrollView>

      {/* Progress / History modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPressIn={playIn}
          onPressOut={playOut}
          onPress={() => setShowHistory(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>progress</Text>
              <Pressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => setShowHistory(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.editGoalsLink}>Close</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.historyList}>
              {recentWorkouts.length === 0 ? (
                <Text style={styles.emptyText}>No workouts yet. Start one to see your progress.</Text>
              ) : (
                recentWorkouts.map((w) => (
                  <View key={w.id} style={styles.workoutItem}>
                    <Text style={styles.workoutName}>{w.name}</Text>
                    <Text style={styles.workoutDetail}>{w.duration} min · {w.exercises.length} exercises</Text>
                    <Text style={styles.workoutDate}>{new Date(w.date).toLocaleDateString()}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Workout log overlay – pans down when Cancel is pressed on leave dialog */}
      {activeWorkout && (
        <Animated.View
          style={[
            styles.workoutOverlay,
            {
              height: windowHeight,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, windowHeight],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={[
              styles.contentContainer,
              { paddingTop: contentTopPadding },
            ]}
          >
            {/* Workout – top bar: back arrow, timer, clock, Workout title, blue Finish */}
            <View style={styles.logTopBar}>
              <View style={styles.logTopLeft}>
                <Pressable
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={handleBackArrowPress}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.logBackArrowWrap}
                >
                  <Text style={styles.logBackArrow}>▼</Text>
                </Pressable>
                <Text style={styles.logTimer}>{formatElapsed(elapsedSeconds)}</Text>
                <Text style={styles.logTitle}>Workout</Text>
                <Text style={styles.logClockIcon}>🕐</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.finishButton, pressed && { opacity: 0.8 }]}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() =>
                  Alert.alert(
                    'Finish Workout',
                    'Save this workout?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Save', onPress: finishWorkout },
                    ]
                  )
                }
              >
                <Text style={styles.finishButtonText}>Finish</Text>
              </Pressable>
            </View>

            {/* Summary: Volume, Sets, muscle icons (reference design) */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryVolumeText}>Volume {totalVolume} {weightUnit}</Text>
              <Text style={styles.summarySetsText}>Sets {totalSets}</Text>
              <View style={styles.summaryIconsRow}>
                <Text style={styles.summaryIcon}>👤</Text>
                <Text style={styles.summaryIcon}>👤</Text>
              </View>
            </View>

            {/* Global rest timer (when active) – large countdown, -15/+15/Skip (reference design) */}
            {restTimerActive && restTimeRemaining > 0 && (
              <View style={styles.restTimerPanel}>
                <Text style={styles.restTimerCountdown}>{formatDuration(restTimeRemaining)}</Text>
                <View style={styles.restTimerButtonsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.restTimerAdjustButton, pressed && { opacity: 0.8 }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={() => setRestTimeRemaining((prev) => Math.max(0, prev - 15))}
                  >
                    <Text style={styles.restTimerAdjustButtonText}>-15</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.restTimerAdjustButton, pressed && { opacity: 0.8 }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={() => setRestTimeRemaining((prev) => prev + 15)}
                  >
                    <Text style={styles.restTimerAdjustButtonText}>+15</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.restTimerSkipButton, pressed && { opacity: 0.8 }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={skipRestTimer}
                  >
                    <Text style={styles.restTimerSkipButtonText}>Skip</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Exercise blocks – no card divider, continuous flow */}
            {activeWorkout.exercises.map((exercise, exerciseIndex) => (
              <View key={exercise.id} style={styles.exerciseBlock}>
                <View style={styles.exerciseBlockHeader}>
                  <Text style={styles.exerciseBlockName}>{exercise.name}</Text>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.exerciseBlockMenu}>⋮</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.notesPlaceholder}>Add notes here...</Text>
                <View style={styles.restTimerRow}>
                  <Text style={styles.restTimerRowIcon}>🕐</Text>
                  <Text style={styles.restTimerRowText}>
                    Rest Timer: {exercise.restTimer ? formatDuration(exercise.restTimer) : '—'}
                  </Text>
                </View>

                {/* Set table */}
                <View style={styles.setTable}>
                  <View style={styles.setTableHeader}>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol1]}>SET</Text>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol2]}>PREVIOUS</Text>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol3]}>{weightUnit.toUpperCase()}</Text>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol4]}>REPS</Text>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol5]}>RPE</Text>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol6]}>✓</Text>
                  </View>
                  {exercise.sets.map((set, setIndex) => (
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
                      <View
                        style={[styles.setTableRow, set.completed && styles.setTableRowCompleted]}
                      >
                        <Text style={[styles.setTableCell, styles.setTableCol1, set.completed && styles.setTableCellCompleted]}>
                          {setIndex + 1}
                        </Text>
                        <Text style={[styles.setTableCell, styles.setTableCol2, set.completed && styles.setTableCellCompleted]}>
                          {setIndex > 0 && exercise.sets[setIndex - 1].weight > 0
                            ? `${exercise.sets[setIndex - 1].weight}×${exercise.sets[setIndex - 1].reps}`
                            : '—'}
                        </Text>
                        <View style={[styles.setTableInputCell, styles.setTableCol3]}>
                          {(set.weight > 0 || (editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'weight')) ? (
                            <Input
                              value={String(set.weight)}
                              onChangeText={(text) => updateSet(exerciseIndex, setIndex, { weight: parseFloat(text) || 0 })}
                              onBlur={() => setEditingCell(null)}
                              autoFocus={editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'weight'}
                              keyboardType="numeric"
                              placeholder="—"
                              containerStyle={StyleSheet.flatten([set.completed ? styles.setTableInputWhenCompleted : styles.setTableInput, styles.setTableInputMinimal])}
                              style={[styles.setTableInputText, styles.setTableInputNoBox, set.completed && styles.setTableInputTextCompleted]}
                              placeholderTextColor={set.completed ? 'rgba(255,255,255,0.7)' : Colors.primaryLight}
                              fontFamily={Font.mono}
                            />
                          ) : (
                            <Pressable
                              onPressIn={playIn}
                              onPressOut={playOut}
                              onPress={() => setEditingCell({ exerciseIndex, setIndex, field: 'weight' })}
                              style={styles.setTableDashCell}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={[styles.setTableCell, set.completed && styles.setTableCellCompleted]}>—</Text>
                            </Pressable>
                          )}
                        </View>
                        <View style={[styles.setTableInputCell, styles.setTableCol4]}>
                          {(set.reps > 0 || (editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'reps')) ? (
                            <Input
                              value={String(set.reps)}
                              onChangeText={(text) => updateSet(exerciseIndex, setIndex, { reps: parseInt(text, 10) || 0 })}
                              onBlur={() => setEditingCell(null)}
                              autoFocus={editingCell?.exerciseIndex === exerciseIndex && editingCell?.setIndex === setIndex && editingCell?.field === 'reps'}
                              keyboardType="numeric"
                              placeholder="—"
                              containerStyle={StyleSheet.flatten([set.completed ? styles.setTableInputWhenCompleted : styles.setTableInput, styles.setTableInputMinimal])}
                              style={[styles.setTableInputText, styles.setTableInputNoBox, set.completed && styles.setTableInputTextCompleted]}
                              placeholderTextColor={set.completed ? 'rgba(255,255,255,0.7)' : Colors.primaryLight}
                              fontFamily={Font.mono}
                            />
                          ) : (
                            <Pressable
                              onPressIn={playIn}
                              onPressOut={playOut}
                              onPress={() => setEditingCell({ exerciseIndex, setIndex, field: 'reps' })}
                              style={styles.setTableDashCell}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={[styles.setTableCell, set.completed && styles.setTableCellCompleted]}>—</Text>
                            </Pressable>
                          )}
                        </View>
                        <TouchableOpacity
                          style={[styles.setTableRpeCell, styles.setTableCol5, set.completed && styles.setTableRpeCellCompleted]}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.setTableRpeText, set.completed && styles.setTableRpeTextCompleted]}>
                            RPE
                          </Text>
                        </TouchableOpacity>
                        <Pressable
                          style={[styles.setTableTickCell, styles.setTableCol6]}
                          onPressIn={playIn}
                          onPressOut={playOut}
                          onPress={() => updateSet(exerciseIndex, setIndex, { completed: !set.completed })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.setTableCell, set.completed && styles.setTableTickCompleted]}>
                            ✓
                          </Text>
                        </Pressable>
                      </View>
                    </Swipeable>
                  ))}
                </View>

                {/* Add set – button adds a new row to the table; KG/REPS edited in the table */}
                <Pressable
                  style={({ pressed }) => [styles.addSetButtonBlock, pressed && { opacity: 0.8 }]}
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={() => addSet(exerciseIndex)}
                >
                  <Text style={styles.addSetButtonBlockText}>+ add set</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
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
  startEmptyButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  startEmptyButtonText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
    textAlign: 'center',
  },
  routinesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  routinesTitle: {
    fontFamily: Font.mono,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  newRoutineButton: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  newRoutineButtonText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
    textAlign: 'center',
  },
  bubbleButton: {
    flex: 1,
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...Shadows.card,
  },
  bubbleButtonIcon: {
    fontFamily: Font.mono,
    fontSize: 20,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
    marginBottom: Spacing.xs,
  },
  bubbleButtonLabel: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  infoBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C4A035',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  infoBubbleIcon: {
    fontSize: 16,
  },
  infoBubbleText: {
    flex: 1,
    fontFamily: Font.mono,
    fontSize: Typography.label,
    letterSpacing: -0.72,
    color: '#1a1a1a',
  },
  infoBubbleClose: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    letterSpacing: -0.72,
    color: '#1a1a1a',
    padding: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: Font.mono,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
    marginBottom: Spacing.sm,
  },
  splitCardBlock: {
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '20',
    ...Shadows.card,
  },
  splitCardName: {
    fontFamily: Font.mono,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
    marginBottom: Spacing.sm,
  },
  splitExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.primaryLight + '12',
    borderRadius: BorderRadius.sm,
  },
  splitExerciseName: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  splitExerciseRest: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  addExerciseToRoutineButton: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    ...Shadows.card,
  },
  addExerciseToRoutineText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    marginBottom: Spacing.xs / 2,
    gap: Spacing.sm,
  },
  dropdownChevron: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  dropdownTitle: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  dropdownList: {
    marginLeft: Spacing.sm,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: Colors.primaryLight + '30',
  },
  tmlsnRoutineCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  tmlsnRoutineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tmlsnRoutineCardTitle: {
    fontFamily: Font.bold,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
    flex: 1,
  },
  tmlsnRoutineExerciseList: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    letterSpacing: -0.72,
    color: Colors.primaryLight + 'cc',
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  tmlsnRoutineStartButton: {
    backgroundColor: '#c6c6c6',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tmlsnRoutineStartButtonText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    letterSpacing: -0.72,
    color: '#2f3031',
  },
  routineItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight + '15',
  },
  routineItemName: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
    marginBottom: 2,
  },
  routineItemDetail: {
    fontFamily: Font.mono,
    fontSize: Typography.label,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  pageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonText: {
    fontSize: 24,
    color: Colors.primaryLight,
  },
  pageHeading: {
    fontFamily: Font.bold,
    fontSize: 28,
    lineHeight: 44,
    marginTop: -4,
    letterSpacing: -1,
    color: Colors.primaryLight,
    textAlign: 'center',
  },
  swipeWidgetWrapper: {
    width: SCREEN_WIDTH,
    alignSelf: 'center',
    marginHorizontal: -Spacing.md,
    marginBottom: Spacing.sm,
    overflow: 'visible',
  },
  swipeWidget: {
    flexGrow: 0,
  },
  swipeWidgetContent: {
    alignItems: 'center',
  },
  swipePage: {
    width: SCREEN_WIDTH,
    height: SWIPE_PAGE_HEIGHT + SWIPE_WIDGET_PADDING_TOP + SWIPE_WIDGET_EXTRA_HEIGHT,
    paddingTop: SWIPE_WIDGET_PADDING_TOP,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  mainMenuButton: {
    alignSelf: 'center',
    width: BUTTON_WIDTH,
    height: MAIN_MENU_BUTTON_HEIGHT,
    borderRadius: 38,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: MAIN_MENU_BUTTON_GAP,
    ...Shadows.card,
  },
  mainMenuButtonText: {
    fontFamily: Font.mono,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0,
    color: '#C6C6C6',
    textAlign: 'center',
  },
  progressCard: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    borderRadius: 38,
    alignSelf: 'center',
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  swipeDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  swipeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight + '40',
  },
  swipeDotActive: {
    backgroundColor: Colors.primaryLight,
  },
  achievementsStack: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: MAIN_MENU_BUTTON_GAP,
    marginBottom: Spacing.sm,
  },
  achievementCard: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    borderRadius: 38,
    alignSelf: 'center',
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    ...Shadows.card,
  },
  cardTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
    letterSpacing: HeadingLetterSpacing,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  editGoalsLink: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: '#C6C6C6',
    fontWeight: Typography.weights.semiBold,
  },
  optionButton: {
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  workoutItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '20',
  },
  workoutName: {
    fontFamily: Font.semiBold,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  workoutDetail: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  workoutDate: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  progressText: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: '#C6C6C6',
    marginTop: Spacing.xs,
  },
  exerciseName: {
    fontFamily: Font.bold,
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
    marginBottom: Spacing.sm,
    letterSpacing: HeadingLetterSpacing,
  },
  setsCompleted: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '20',
  },
  setText: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  setEntry: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  setInput: {
    flex: 1,
  },
  addSetButton: {
    marginTop: Spacing.md,
  },
  timerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: BorderRadius.sm,
  },
  timerToggleText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
  timerDuration: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: '#C6C6C6',
    marginLeft: Spacing.sm,
  },
  nextButton: {
    marginTop: Spacing.md,
  },
  restTimerCard: {
    backgroundColor: Colors.accentRed + '20',
    borderWidth: 2,
    borderColor: Colors.accentRed,
  },
  restTimerTitle: {
    fontFamily: Font.bold,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
    textAlign: 'center',
    letterSpacing: HeadingLetterSpacing,
  },
  restTimerTime: {
    fontSize: 64,
    fontWeight: Typography.weights.bold,
    color: Colors.accentRed,
    textAlign: 'center',
    marginVertical: Spacing.lg,
  },
  skipButton: {
    marginTop: Spacing.md,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
  },
  historyList: {
    maxHeight: 400,
  },
  splitOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  splitName: {
    fontFamily: Font.semiBold,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
    letterSpacing: HeadingLetterSpacing,
  },
  splitDetail: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  cancelButton: {
    marginTop: Spacing.lg,
  },
  // Log Workout screen layout
  logTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  logTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logBackArrowWrap: {
    padding: Spacing.xs,
  },
  logBackArrow: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    lineHeight: Typography.dataValue,
    letterSpacing: -0.72,
  },
  logTimer: {
    fontFamily: Font.mono,
    fontSize: Typography.dataValue,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  logTitle: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
  },
  logClockIcon: {
    fontSize: 16,
    marginLeft: Spacing.xs,
  },
  finishButton: {
    backgroundColor: Colors.accentBlue,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  finishButtonText: {
    fontFamily: Font.mono,
    fontSize: Typography.body,
    color: Colors.white,
    letterSpacing: -0.72,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryVolumeText: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  summarySetsText: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  summaryIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
  },
  summaryIcon: {
    fontSize: 18,
    opacity: 0.9,
  },
  restTimerPanel: {
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    ...Shadows.card,
  },
  restTimerCountdown: {
    fontFamily: Font.bold,
    fontSize: 48,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  restTimerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  restTimerAdjustButton: {
    backgroundColor: Colors.primaryDarkLighter,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.card,
  },
  restTimerAdjustButtonText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  restTimerSkipButton: {
    backgroundColor: Colors.accentBlue,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.card,
  },
  restTimerSkipButtonText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.white,
  },
  exerciseBlock: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.card,
  },
  exerciseBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  exerciseBlockName: {
    fontFamily: Font.mono,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
    flex: 1,
  },
  exerciseBlockMenu: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    padding: Spacing.xs,
  },
  notesPlaceholder: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight + '99',
    marginBottom: Spacing.sm,
  },
  restTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  restTimerRowIcon: {
    fontSize: 14,
  },
  restTimerRowText: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  setTable: {
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
  },
  setTableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  setTableHeaderCell: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
    flex: 1,
    textAlign: 'center',
  },
  setTableCol1: { minWidth: 28 },
  setTableCol2: { marginLeft: 32, minWidth: 72 },
  setTableCol3: { marginLeft: 32, minWidth: 28 },
  setTableCol4: { marginLeft: 32, minWidth: 40 },
  setTableCol5: { marginLeft: 32, minWidth: 28 },
  setTableCol6: { marginLeft: 32, minWidth: 24 },
  setTableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  setRowDeleteAction: {
    backgroundColor: Colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    minHeight: 52,
  },
  setRowDeleteText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.white,
    fontWeight: Typography.weights.semiBold,
  },
  setTableRowCompleted: {
    // no background – same as panel
  },
  setTableCell: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
    flex: 1,
    textAlign: 'center',
  },
  setTableCellCompleted: {
    color: '#ffffff',
  },
  setTableRpeCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  setTableRpeCellCompleted: {
    // no background – same as panel
  },
  setTableRpeText: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  setTableRpeTextCompleted: {
    color: Colors.white,
  },
  setTableTickCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTableTickCompleted: {
    color: '#ffffff',
  },
  setTableInputTextCompleted: {
    color: '#ffffff',
  },
  setTableInputCell: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  setTableInputMinimal: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    marginBottom: 0,
  },
  setTableDashCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTableInputText: {
    fontFamily: Font.mono,
    fontSize: 12,
    letterSpacing: -0.72,
    color: Colors.primaryLight,
  },
  setTableInputNoBox: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  setTableInput: {
    marginBottom: 0,
    minHeight: 36,
  },
  setTableInputWhenCompleted: {
    marginBottom: 0,
    minHeight: 36,
  },
  addSetButtonBlock: {
    width: 368,
    height: 39,
    alignSelf: 'center',
    backgroundColor: '#C6C6C6',
    marginTop: Spacing.sm,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  addSetButtonBlockText: {
    fontFamily: Font.mono,
    fontSize: 12,
    color: '#2F3031',
    letterSpacing: -0.72,
  },
});
