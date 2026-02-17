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
  Animated,
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Input } from '../../../components/Input';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Font } from '../../../constants/theme';
import { TMLSN_SPLITS } from '../../../constants/workoutSplits';
import {
  getRecentWorkouts,
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
import { StreakWidget } from '../../../components/StreakWidget';
import { AnimatedPressable } from '../../../components/AnimatedPressable';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { Card } from '../../../components/Card';
import { ExercisePickerModal } from '../../../components/ExercisePickerModal';


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
const TOP_LEFT_PILL_TOP = 54; // Match home section layout
const SETTINGS_CIRCLE_SIZE = 40; // Match home profile circle
const THREE_BUTTON_STACK_HEIGHT = MAIN_MENU_BUTTON_HEIGHT * 3 + MAIN_MENU_BUTTON_GAP * 3; // 252
const SWIPE_PAGE_HEIGHT = THREE_BUTTON_STACK_HEIGHT; // same height for both pages so y-axis aligns during swipe
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
  const { startSplitId, startRoutineId, startEmpty } = useLocalSearchParams<{
    startSplitId?: string;
    startRoutineId?: string;
    startEmpty?: string;
  }>();
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSession[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(initialActiveWorkout ?? null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showSplitSelection, setShowSplitSelection] = useState(false);
  const [showExerciseEntry, setShowExerciseEntry] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  /** When set, picker is in "replace" mode: onSelect replaces this exercise index instead of appending */
  const [replaceExerciseIndex, setReplaceExerciseIndex] = useState<number | null>(null);
  /** When set, custom exercise menu (replace/delete) is open for this exercise index */
  const [exerciseMenuIndex, setExerciseMenuIndex] = useState<number | null>(null);
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
    Alert.alert('Success!', 'Workout saved successfully', [
      { text: 'OK', onPress: () => onCloseModal?.() },
    ]);
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

  const slideAnim = useRef(new Animated.Value(asModal ? 0 : 1)).current;
  const windowHeight = Dimensions.get('window').height;
  const PAN_DOWN_DURATION = 280;
  const PAN_UP_DURATION = 350;

  useLayoutEffect(() => {
    if (asModal && activeWorkout) slideAnim.setValue(0);
  }, [asModal]);

  useEffect(() => {
    if (activeWorkout && !asModal) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: PAN_UP_DURATION,
        useNativeDriver: true,
      }).start();
    }
  }, [activeWorkout?.id, asModal]);

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

  return (
    <View style={styles.container}>
      {/* Background image – match home section */}
      <Image
        source={require('../../../assets/home-background.png')}
        style={styles.homeBackgroundImage}
        resizeMode="cover"
      />
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
            <View style={styles.settingsPill}>
              <LinearGradient
                colors={['#4E4F50', '#4A4B4C']}
                style={[StyleSheet.absoluteFillObject, { borderRadius: SETTINGS_CIRCLE_SIZE / 2 }]}
              />
              <LinearGradient
                colors={['#363738', '#2E2F30']}
                style={[
                  StyleSheet.absoluteFillObject,
                  { top: 1, left: 1, right: 1, bottom: 1, borderRadius: SETTINGS_CIRCLE_SIZE / 2 - 1 },
                ]}
              />
              <Text style={styles.settingsButtonText}>⚙</Text>
            </View>
          </Pressable>
          </View>
        </View>
        </AnimatedFadeInUp>

        {/* Swipeable widget: full screen width for centered snap */}
        <AnimatedFadeInUp delay={160} duration={380} trigger={animTrigger}>
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
            {/* Single page: progress card (tmlsn routines, your routines, start empty workout only via FAB) */}
            <View style={styles.swipePage}>
              <AnimatedPressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => setShowHistory(true)}
                style={styles.mainMenuButtonWrap}
              >
                <Card gradientFill borderRadius={38} style={styles.progressCard}>
                  <Text style={styles.mainMenuButtonText}>progress</Text>
                </Card>
              </AnimatedPressable>
            </View>
          </ScrollView>
          {/* Single page: no swipe dots */}
          <View style={styles.swipeDots}>
            <View style={[styles.swipeDot, styles.swipeDotActive]} />
          </View>
        </View>
        </AnimatedFadeInUp>

        {/* Achievements only – streak moved to header widget */}
        <AnimatedFadeInUp delay={320} duration={380} trigger={animTrigger}>
        <View style={styles.achievementsStack}>
          <AnimatedPressable style={styles.achievementCardWrap}>
            <Card gradientFill borderRadius={38} style={styles.achievementCard}>
              <Text style={styles.mainMenuButtonText}>achievements</Text>
            </Card>
          </AnimatedPressable>
        </View>
        </AnimatedFadeInUp>

      </ScrollView>

      {/* ─── HEVY-STYLE PROGRESS / HISTORY MODAL ─── */}
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
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Progress</Text>
              <Pressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={() => setShowHistory(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* Stats summary */}
            <View style={styles.historyStatsRow}>
              <View style={styles.historyStatPill}>
                <Text style={styles.historyStatValue}>{recentWorkouts.length}</Text>
                <Text style={styles.historyStatLabel}>Sessions</Text>
              </View>
              <View style={styles.historyStatPill}>
                <Text style={styles.historyStatValue}>
                  {recentWorkouts.reduce((acc, w) => acc + w.exercises.reduce((a, e) => a + e.sets.length, 0), 0)}
                </Text>
                <Text style={styles.historyStatLabel}>Total Sets</Text>
              </View>
            </View>

            {/* Session list */}
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {recentWorkouts.length === 0 ? (
                <View style={styles.historyEmpty}>
                  <Text style={styles.historyEmptyIcon}>◇</Text>
                  <Text style={styles.historyEmptyText}>No workouts yet</Text>
                  <Text style={styles.historyEmptySubtext}>Start one to see your progress</Text>
                </View>
              ) : (
                recentWorkouts.map((w) => {
                  const wSets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
                  const wVolume = w.exercises.reduce(
                    (a, e) => a + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0
                  );
                  return (
                    <View key={w.id} style={styles.historySessionCard}>
                      {/* Session header */}
                      <View style={styles.historySessionHeader}>
                        <View style={styles.historySessionIcon}>
                          <Text style={styles.historySessionIconText}>◆</Text>
                        </View>
                        <View style={styles.historySessionTitleCol}>
                          <Text style={styles.historySessionName}>{w.name}</Text>
                          <Text style={styles.historySessionDate}>
                            {new Date(w.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                      </View>
                      {/* Session stats */}
                      <View style={styles.historySessionStats}>
                        <View style={styles.historySessionStatItem}>
                          <Text style={styles.historySessionStatIcon}>◎</Text>
                          <Text style={styles.historySessionStatText}>{w.exercises.length} exercises</Text>
                        </View>
                        <View style={styles.historySessionStatItem}>
                          <Text style={styles.historySessionStatIcon}>◉</Text>
                          <Text style={styles.historySessionStatText}>{wSets} sets</Text>
                        </View>
                        <View style={styles.historySessionStatItem}>
                          <Text style={styles.historySessionStatIcon}>⏱</Text>
                          <Text style={styles.historySessionStatText}>{w.duration} min</Text>
                        </View>
                        {wVolume > 0 && (
                          <View style={styles.historySessionStatItem}>
                            <Text style={styles.historySessionStatIcon}>⚖</Text>
                            <Text style={styles.historySessionStatText}>{wVolume.toLocaleString()} {weightUnit}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
      </>
      )}

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
              { paddingTop: TOP_LEFT_PILL_TOP, paddingBottom: Math.max(Spacing.md, insets.bottom + 100) },
            ]}
          >
            {/* ─── HEVY-STYLE TOP BAR ─── */}
            <View style={styles.logTopBar}>
              <Pressable
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={handleBackArrowPress}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.logBackArrowWrap}
              >
                <Text style={styles.logBackArrow}>▼</Text>
              </Pressable>
              <View style={styles.logTopCenter}>
                <Text style={styles.logTitle}>{activeWorkout.name || 'Workout'}</Text>
                <Text style={styles.logTimer}>{formatElapsed(elapsedSeconds)}</Text>
              </View>
              <Pressable
                style={({ pressed }) => [styles.finishButton, pressed && { opacity: 0.85 }]}
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

            {/* ─── HEVY-STYLE SUMMARY STATS ROW ─── */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryStatPill}>
                <Text style={styles.summaryStatIcon}>⚖</Text>
                <Text style={styles.summaryStatValue}>{totalVolume.toLocaleString()}</Text>
                <Text style={styles.summaryStatUnit}>{weightUnit}</Text>
              </View>
              <View style={styles.summaryStatPill}>
                <Text style={styles.summaryStatIcon}>◉</Text>
                <Text style={styles.summaryStatValue}>{totalSets}</Text>
                <Text style={styles.summaryStatUnit}>sets</Text>
              </View>
              <View style={styles.summaryStatPill}>
                <Text style={styles.summaryStatIcon}>◎</Text>
                <Text style={styles.summaryStatValue}>{activeWorkout.exercises.length}</Text>
                <Text style={styles.summaryStatUnit}>exercises</Text>
              </View>
            </View>

            {/* ─── HEVY-STYLE REST TIMER PANEL ─── */}
            {restTimerActive && restTimeRemaining > 0 && (
              <View style={styles.restTimerPanel}>
                <View style={styles.restTimerHeader}>
                  <Text style={styles.restTimerLabel}>REST TIMER</Text>
                </View>
                <Text style={styles.restTimerCountdown}>{formatDuration(restTimeRemaining)}</Text>
                <View style={styles.restTimerProgressTrack}>
                  <View style={[styles.restTimerProgressFill, { width: `${Math.max(0, (restTimeRemaining / (activeWorkout.exercises[currentExerciseIndex]?.restTimer || 120)) * 100)}%` }]} />
                </View>
                <View style={styles.restTimerButtonsRow}>
                  <Pressable
                    style={({ pressed }) => [styles.restTimerAdjustButton, pressed && { opacity: 0.8 }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={() => setRestTimeRemaining((prev) => Math.max(0, prev - 15))}
                  >
                    <Text style={styles.restTimerAdjustButtonText}>−15s</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.restTimerSkipButton, pressed && { opacity: 0.8 }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={skipRestTimer}
                  >
                    <Text style={styles.restTimerSkipButtonText}>Skip</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.restTimerAdjustButton, pressed && { opacity: 0.8 }]}
                    onPressIn={playIn}
                    onPressOut={playOut}
                    onPress={() => setRestTimeRemaining((prev) => prev + 15)}
                  >
                    <Text style={styles.restTimerAdjustButtonText}>+15s</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ─── HEVY-STYLE EXERCISE BLOCKS ─── */}
            {activeWorkout.exercises.length === 0 ? (
              <Pressable
                style={({ pressed }) => [styles.addSetButtonBlock, styles.addExerciseBlock, pressed && { opacity: 0.85 }]}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={openExercisePicker}
              >
                <Text style={styles.addSetButtonBlockText}>+ Add exercise</Text>
              </Pressable>
            ) : null}
            {activeWorkout.exercises.map((exercise, exerciseIndex) => (
              <View key={exercise.id} style={styles.exerciseBlock}>
                {/* Exercise header */}
                <View style={styles.exerciseBlockHeader}>
                  <View style={styles.exerciseBlockTitleRow}>
                    <View style={styles.exerciseBlockIcon}>
                      <Text style={styles.exerciseBlockIconText}>◆</Text>
                    </View>
                    <Text style={styles.exerciseBlockName}>{exercise.name}</Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => showExerciseMenu(exerciseIndex)}
                  >
                    <Text style={styles.exerciseBlockMenu}>⋮</Text>
                  </TouchableOpacity>
                </View>

                {/* Rest timer badge */}
                {exercise.restTimer ? (
                  <View style={styles.restTimerBadge}>
                    <Text style={styles.restTimerBadgeText}>
                      Rest: {formatDuration(exercise.restTimer)}
                    </Text>
                  </View>
                ) : null}

                {/* Notes */}
                <Text style={styles.notesPlaceholder}>+ Add notes</Text>

                {/* Set table header */}
                <View style={styles.setTableHeader}>
                  <Text style={[styles.setTableHeaderCell, { width: 36 }]}>SET</Text>
                  <Text style={[styles.setTableHeaderCell, { flex: 1 }]}>PREVIOUS</Text>
                  <Text style={[styles.setTableHeaderCell, { width: 72 }]}>{weightUnit.toUpperCase()}</Text>
                  <Text style={[styles.setTableHeaderCell, { width: 56 }]}>REPS</Text>
                  <Text style={[styles.setTableHeaderCell, { width: 36 }]}>✓</Text>
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
                      <View style={[styles.setRow, isCompleted && styles.setRowCompleted]}>
                        {/* Set number dot */}
                        <View style={[styles.setDot, isCompleted && styles.setDotCompleted]}>
                          <Text style={[styles.setDotText, isCompleted && styles.setDotTextCompleted]}>
                            {setIndex + 1}
                          </Text>
                        </View>

                        {/* Previous */}
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          <Text style={[styles.setCellDim, isCompleted && styles.setCellDimCompleted]}>
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
                              style={[styles.setInputText, isCompleted && styles.setInputTextCompleted]}
                              placeholderTextColor={Colors.primaryLight + '60'}
                            />
                          ) : (
                            <Pressable
                              onPressIn={playIn}
                              onPressOut={playOut}
                              onPress={() => setEditingCell({ exerciseIndex, setIndex, field: 'weight' })}
                              style={styles.setInputPlaceholder}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.setInputPlaceholderText}>—</Text>
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
                              style={[styles.setInputText, isCompleted && styles.setInputTextCompleted]}
                              placeholderTextColor={Colors.primaryLight + '60'}
                            />
                          ) : (
                            <Pressable
                              onPressIn={playIn}
                              onPressOut={playOut}
                              onPress={() => setEditingCell({ exerciseIndex, setIndex, field: 'reps' })}
                              style={styles.setInputPlaceholder}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={styles.setInputPlaceholderText}>—</Text>
                            </Pressable>
                          )}
                        </View>

                        {/* Completion checkmark */}
                        <Pressable
                          style={[styles.setCheckWrap, isCompleted && styles.setCheckWrapCompleted]}
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
                          <Text style={[styles.setCheckText, isCompleted && styles.setCheckTextCompleted]}>✓</Text>
                        </Pressable>
                      </View>
                    </Swipeable>
                  );
                })}

                {/* Add set button */}
                <Pressable
                  style={({ pressed }) => [styles.addSetButtonBlock, pressed && { opacity: 0.85 }]}
                  onPressIn={playIn}
                  onPressOut={playOut}
                  onPress={() => addSet(exerciseIndex)}
                >
                  <Text style={styles.addSetButtonBlockText}>+ Add Set</Text>
                </Pressable>
              </View>
            ))}
            {activeWorkout.exercises.length > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.addSetButtonBlock, styles.addExerciseBlock, pressed && { opacity: 0.85 }]}
                onPressIn={playIn}
                onPressOut={playOut}
                onPress={openExercisePicker}
              >
                <Text style={styles.addSetButtonBlockText}>+ Add exercise</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Animated.View>
      )}

      {activeWorkout && exerciseMenuIndex !== null && (
        <Modal visible animationType="fade" transparent>
          <Pressable style={styles.exerciseMenuOverlay} onPress={closeExerciseMenu}>
            <Pressable style={styles.exerciseMenuCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.exerciseMenuTitle} numberOfLines={1}>
                {activeWorkout.exercises[exerciseMenuIndex]?.name ?? 'Exercise'}
              </Text>
              <TouchableOpacity
                style={styles.exerciseMenuOption}
                onPress={handleReplaceFromMenu}
                activeOpacity={0.7}
              >
                <Text style={styles.exerciseMenuOptionText}>Replace exercise</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exerciseMenuOption}
                onPress={handleDeleteFromMenu}
                activeOpacity={0.7}
              >
                <Text style={[styles.exerciseMenuOptionText, styles.exerciseMenuOptionDestructive]}>
                  Delete exercise
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exerciseMenuOption, styles.exerciseMenuOptionCancel]}
                onPress={closeExerciseMenu}
                activeOpacity={0.7}
              >
                <Text style={styles.exerciseMenuOptionText}>Cancel</Text>
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
  homeBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
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
  settingsButtonText: {
    fontSize: 20,
    color: Colors.primaryLight,
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
  mainMenuButtonWrap: {
    alignSelf: 'center',
    marginBottom: MAIN_MENU_BUTTON_GAP,
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
  progressCard: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    marginVertical: 0,
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
  // (old exercise/set/timer styles removed – replaced by Hevy-style components above)
  // ─── HEVY-STYLE MODAL ──────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primaryLight + '80',
    letterSpacing: -0.11,
  },
  historyStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.md,
  },
  historyStatPill: {
    flex: 1,
    backgroundColor: Colors.primaryLight + '0A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
    paddingVertical: 12,
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  historyStatLabel: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + '50',
    letterSpacing: -0.11,
    textTransform: 'uppercase' as const,
    marginTop: 2,
  },
  historyList: {
    maxHeight: 500,
  },
  historyEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  historyEmptyIcon: {
    fontSize: 28,
    color: Colors.primaryLight + '30',
    marginBottom: 10,
  },
  historyEmptyText: {
    fontSize: Typography.body,
    fontWeight: '500',
    color: Colors.primaryLight + '60',
    letterSpacing: -0.11,
    marginBottom: 4,
  },
  historyEmptySubtext: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + '40',
    letterSpacing: -0.11,
  },
  historySessionCard: {
    backgroundColor: Colors.primaryLight + '08',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '12',
    padding: 14,
    marginBottom: 10,
  },
  historySessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  historySessionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySessionIconText: {
    fontSize: 14,
    color: Colors.primaryLight + '80',
  },
  historySessionTitleCol: {
    flex: 1,
  },
  historySessionName: {
    fontSize: Typography.body,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
  },
  historySessionDate: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + '50',
    letterSpacing: -0.11,
    marginTop: 1,
  },
  historySessionStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historySessionStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight + '0A',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  historySessionStatIcon: {
    fontSize: 11,
    color: Colors.primaryLight + '50',
  },
  historySessionStatText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primaryLight + '70',
    letterSpacing: -0.11,
  },
  // (old split selection styles removed)
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
  logBackArrow: {
    fontSize: 18,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.11,
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
    backgroundColor: Colors.primaryLight + '10',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  restTimerBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primaryLight + '80',
    letterSpacing: -0.11,
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
