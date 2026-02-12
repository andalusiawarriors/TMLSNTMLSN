import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  Image,
  Animated,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { TMLSN_SPLITS } from '../../constants/workoutSplits';
import {
  getRecentWorkouts,
  saveWorkoutSession,
  getSavedRoutines,
  saveSavedRoutine,
} from '../../utils/storage';
import { WorkoutSession, Exercise, Set, WorkoutSplit, SavedRoutine } from '../../types';
import { generateId, formatDuration } from '../../utils/helpers';
import { scheduleRestTimerNotification } from '../../utils/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_WIDTH = Math.min(333, SCREEN_WIDTH - 48);
const PROGRESS_CARD_WIDTH = Math.min(333, SCREEN_WIDTH - 48);
const ACHIEVEMENT_BUTTON_SIZE = Math.min(155, (SCREEN_WIDTH - 48 - 23) / 2);

export default function WorkoutScreen() {
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSession[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showSplitSelection, setShowSplitSelection] = useState(false);
  const [showExerciseEntry, setShowExerciseEntry] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [tmlsnExpanded, setTmlsnExpanded] = useState(false);
  const [myRoutinesExpanded, setMyRoutinesExpanded] = useState(false);
  const [showReorderHint, setShowReorderHint] = useState(true);
  const [showRoutineBuilder, setShowRoutineBuilder] = useState(false);
  const [savedRoutines, setSavedRoutines] = useState<SavedRoutine[]>([]);
  const [swipePageIndex, setSwipePageIndex] = useState(0);
  const [editingRoutine, setEditingRoutine] = useState<{
    name: string;
    exercises: { id: string; name: string; restTimer: number }[];
  }>({ name: 'New Routine', exercises: [] });
  
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

  useEffect(() => {
    loadWorkouts();
  }, []);

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
    const [workouts, routines] = await Promise.all([
      getRecentWorkouts(10),
      getSavedRoutines(),
    ]);
    setRecentWorkouts(workouts);
    setSavedRoutines(routines);
  };

  const startWorkoutFromSplit = (split: WorkoutSplit) => {
    slideAnim.setValue(0);
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
    slideAnim.setValue(0);
    const exercises: Exercise[] = routine.exercises.map((ex) => ({
      id: generateId(),
      name: ex.name,
      sets: [],
      restTimer: ex.restTimer,
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

  const openRoutineBuilder = () => {
    setEditingRoutine({ name: 'New Routine', exercises: [] });
    setShowRoutineBuilder(true);
  };

  const addExerciseToRoutine = (name: string, restTimer: number = 120) => {
    setEditingRoutine((prev) => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        { id: generateId(), name, restTimer },
      ],
    }));
  };

  const removeExerciseFromRoutine = (id: string) => {
    setEditingRoutine((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== id),
    }));
  };

  const saveRoutine = async () => {
    if (editingRoutine.exercises.length === 0) {
      Alert.alert('No exercises', 'Add at least one exercise to save the routine.');
      return;
    }
    let name = editingRoutine.name.trim();
    if (!name || name === 'New Routine') {
      Alert.prompt(
        'Routine name',
        'Enter a name for this routine',
        (text) => {
          if (text?.trim()) {
            saveRoutineWithName(text.trim());
          }
        }
      );
      return;
    }
    saveRoutineWithName(name);
  };

  const saveRoutineWithName = async (name: string) => {
    const routine: SavedRoutine = {
      id: generateId(),
      name,
      exercises: editingRoutine.exercises.map((e) => ({ ...e })),
    };
    await saveSavedRoutine(routine);
    await loadWorkouts();
    setShowRoutineBuilder(false);
    setEditingRoutine({ name: 'New Routine', exercises: [] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', `"${name}" saved to My Routines.`);
  };

  const startFreeformWorkout = () => {
    slideAnim.setValue(0);
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

  const slideAnim = useRef(new Animated.Value(0)).current;
  const windowHeight = Dimensions.get('window').height;
  const PAN_DOWN_DURATION = 280;

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
  const headerHeight = 44;
  const contentTopPadding = ((insets.top + headerHeight) / 2 + Spacing.md) * 1.2;

  return (
    <View style={styles.container}>
      {/* Main menu – always present (underneath when workout overlay is shown) */}
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: contentTopPadding },
        ]}
      >
        {/* Header: profile + tmlsn tracker. */}
        <View style={styles.pageHeaderRow}>
          <Image
            source={require('../../assets/tmlsn-calories-logo.png')}
            style={styles.pageHeaderLogo}
            resizeMode="contain"
          />
          <Text style={styles.pageHeading}>tmlsn tracker.</Text>
        </View>

        {/* Swipeable widget: 3 buttons | progress card */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setSwipePageIndex(page);
          }}
          style={styles.swipeWidget}
          contentContainerStyle={styles.swipeWidgetContent}
        >
          {/* Page 0: 3 buttons */}
          <View style={styles.swipePage}>
            <TouchableOpacity
              style={styles.mainMenuButton}
              onPress={() => setTmlsnExpanded(!tmlsnExpanded)}
              activeOpacity={0.8}
            >
              <Text style={styles.mainMenuButtonText}>tmlsn routines.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mainMenuButton}
              onPress={() => setMyRoutinesExpanded(!myRoutinesExpanded)}
              activeOpacity={0.8}
            >
              <Text style={styles.mainMenuButtonText}>your routines.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mainMenuButton}
              onPress={startFreeformWorkout}
              activeOpacity={0.8}
            >
              <Text style={styles.mainMenuButtonText}>start empty workout</Text>
            </TouchableOpacity>
          </View>
          {/* Page 1: progress card */}
          <View style={styles.swipePage}>
            <TouchableOpacity
              style={styles.progressCard}
              activeOpacity={0.8}
              onPress={() => setShowHistory(true)}
            >
              <Text style={styles.mainMenuButtonText}>progress</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Swipe dots */}
        <View style={styles.swipeDots}>
          <View style={[styles.swipeDot, swipePageIndex === 0 && styles.swipeDotActive]} />
          <View style={[styles.swipeDot, swipePageIndex === 1 && styles.swipeDotActive]} />
        </View>

        {/* Achievements and Streak */}
        <View style={styles.achievementsRow}>
          <TouchableOpacity style={styles.achievementButton} activeOpacity={0.8}>
            <Text style={styles.mainMenuButtonText}>achievements</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.achievementButton} activeOpacity={0.8}>
            <Text style={styles.mainMenuButtonText}>streak</Text>
          </TouchableOpacity>
        </View>

        {/* Info bubble – press and hold to reorder */}
        {showReorderHint && (
          <View style={styles.infoBubble}>
            <Text style={styles.infoBubbleIcon}>👆</Text>
            <Text style={styles.infoBubbleText}>Press and hold a routine to reorder</Text>
            <TouchableOpacity
              onPress={() => setShowReorderHint(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.infoBubbleClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* TMLSN workouts – expanded when tmlsn routines tapped */}
        {tmlsnExpanded && (
          <View style={styles.dropdownList}>
            {TMLSN_SPLITS.map((split) => (
              <View key={split.id} style={styles.tmlsnRoutineCard}>
                <View style={styles.tmlsnRoutineCardHeader}>
                  <Text style={styles.tmlsnRoutineCardTitle}>
                    {split.name.toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={styles.tmlsnRoutineExerciseList}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {split.exercises.map((ex) => ex.name).join(', ')}
                </Text>
                <TouchableOpacity
                  style={styles.tmlsnRoutineStartButton}
                  onPress={() => startWorkoutFromSplit(split)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.tmlsnRoutineStartButtonText}>start routine</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* My Routines – expanded when your routines tapped */}
        {myRoutinesExpanded && (
          <View style={styles.dropdownList}>
            <TouchableOpacity
              style={styles.newRoutineButton}
              onPress={openRoutineBuilder}
              activeOpacity={0.8}
            >
              <Text style={styles.newRoutineButtonText}>+ new routine</Text>
            </TouchableOpacity>
            {savedRoutines.length === 0 ? (
              <Text style={styles.emptyText}>No routines yet. Create one above.</Text>
            ) : (
              savedRoutines.map((routine) => (
                <TouchableOpacity
                  key={routine.id}
                  style={styles.routineItem}
                  onPress={() => startWorkoutFromSavedRoutine(routine)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.routineItemName}>{routine.name}</Text>
                  <Text style={styles.routineItemDetail}>
                    {routine.exercises.length} exercises
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Progress / History modal */}
      <Modal
        visible={showHistory}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistory(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHistory(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>progress</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.editGoalsLink}>Close</Text>
              </TouchableOpacity>
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
        </TouchableOpacity>
      </Modal>

      {/* Routine builder overlay – same layout as log workout, no timer; Save top right */}
      {showRoutineBuilder && (
        <View style={[styles.workoutOverlay, { height: windowHeight }]}>
          <ScrollView
            contentContainerStyle={[
              styles.contentContainer,
              { paddingTop: contentTopPadding },
            ]}
          >
            {/* Header: back arrow, title, Save */}
            <View style={styles.logTopBar}>
              <View style={styles.logTopLeft}>
                <TouchableOpacity
                  onPress={() => {
                    setShowRoutineBuilder(false);
                    setEditingRoutine({ name: 'New Routine', exercises: [] });
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.logBackArrowWrap}
                >
                  <Text style={styles.logBackArrow}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    Alert.prompt(
                      'Routine name',
                      'Enter a name for this routine',
                      (text) => {
                        if (text?.trim()) {
                          setEditingRoutine((prev) => ({ ...prev, name: text.trim() }));
                        }
                      },
                      'plain-text',
                      editingRoutine.name === 'New Routine' ? '' : editingRoutine.name
                    );
                  }}
                >
                  <Text style={styles.logTitle}>{editingRoutine.name}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.finishButton}
                onPress={saveRoutine}
                activeOpacity={0.8}
              >
                <Text style={styles.finishButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* Exercise cards – name + rest timer only */}
            {editingRoutine.exercises.map((ex) => (
              <Card key={ex.id} style={styles.exerciseBlock}>
                <View style={styles.exerciseBlockHeader}>
                  <Text style={styles.exerciseBlockName}>{ex.name}</Text>
                  <TouchableOpacity
                    onPress={() => removeExerciseFromRoutine(ex.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.exerciseBlockMenu}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.restTimerRow}>
                  <Text style={styles.restTimerRowIcon}>🕐</Text>
                  <Text style={styles.restTimerRowText}>
                    Rest: {formatDuration(ex.restTimer)}
                  </Text>
                </View>
              </Card>
            ))}

            {/* Add Exercise */}
            <TouchableOpacity
              style={styles.addExerciseToRoutineButton}
              onPress={() => {
                Alert.prompt(
                  'Add Exercise',
                  'Enter exercise name',
                  (text) => {
                    if (text?.trim()) {
                      addExerciseToRoutine(text.trim(), 120);
                    }
                  }
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.addExerciseToRoutineText}>+ Add Exercise</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
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
              { paddingTop: contentTopPadding },
            ]}
          >
            {/* Workout – top bar: back arrow, timer, clock, Workout title, blue Finish */}
            <View style={styles.logTopBar}>
              <View style={styles.logTopLeft}>
                <TouchableOpacity
                  onPress={handleBackArrowPress}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={styles.logBackArrowWrap}
                >
                  <Text style={styles.logBackArrow}>▼</Text>
                </TouchableOpacity>
                <Text style={styles.logTimer}>{formatElapsed(elapsedSeconds)}</Text>
                <Text style={styles.logTitle}>Workout</Text>
                <Text style={styles.logClockIcon}>🕐</Text>
              </View>
              <TouchableOpacity
                style={styles.finishButton}
                onPress={() => {
                  Alert.alert(
                    'Finish Workout',
                    'Save this workout?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Save', onPress: finishWorkout },
                    ]
                  );
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.finishButtonText}>Finish</Text>
              </TouchableOpacity>
            </View>

            {/* Summary: Volume, Sets, muscle icons (reference design) */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryVolumeText}>Volume {totalVolume} kg</Text>
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
                  <TouchableOpacity
                    style={styles.restTimerAdjustButton}
                    onPress={() => setRestTimeRemaining((prev) => Math.max(0, prev - 15))}
                  >
                    <Text style={styles.restTimerAdjustButtonText}>-15</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.restTimerAdjustButton}
                    onPress={() => setRestTimeRemaining((prev) => prev + 15)}
                  >
                    <Text style={styles.restTimerAdjustButtonText}>+15</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.restTimerSkipButton} onPress={skipRestTimer}>
                    <Text style={styles.restTimerSkipButtonText}>Skip</Text>
                  </TouchableOpacity>
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
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol3]}>KG</Text>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol4]}>REPS</Text>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol5]}>RPE</Text>
                    <Text style={[styles.setTableHeaderCell, styles.setTableCol6]}>✓</Text>
                  </View>
                  {exercise.sets.map((set, setIndex) => (
                    <Swipeable
                      key={set.id}
                      renderRightActions={() => (
                        <TouchableOpacity
                          style={styles.setRowDeleteAction}
                          onPress={() => removeSet(exerciseIndex, setIndex)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.setRowDeleteText}>Delete</Text>
                        </TouchableOpacity>
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
                            <TouchableOpacity
                              onPress={() => setEditingCell({ exerciseIndex, setIndex, field: 'weight' })}
                              style={styles.setTableDashCell}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={[styles.setTableCell, set.completed && styles.setTableCellCompleted]}>—</Text>
                            </TouchableOpacity>
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
                            <TouchableOpacity
                              onPress={() => setEditingCell({ exerciseIndex, setIndex, field: 'reps' })}
                              style={styles.setTableDashCell}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Text style={[styles.setTableCell, set.completed && styles.setTableCellCompleted]}>—</Text>
                            </TouchableOpacity>
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
                        <TouchableOpacity
                          style={[styles.setTableTickCell, styles.setTableCol6]}
                          onPress={() => updateSet(exerciseIndex, setIndex, { completed: !set.completed })}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.setTableCell, set.completed && styles.setTableTickCompleted]}>
                            ✓
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </Swipeable>
                  ))}
                </View>

                {/* Add set – button adds a new row to the table; KG/REPS edited in the table */}
                <TouchableOpacity
                  style={styles.addSetButtonBlock}
                  onPress={() => addSet(exerciseIndex)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addSetButtonBlockText}>+ add set</Text>
                </TouchableOpacity>
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
    fontFamily: Font.mono,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: -0.72,
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
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  pageHeaderLogo: {
    height: 44,
    width: 44,
  },
  pageHeading: {
    fontFamily: Font.bold,
    fontSize: 28,
    lineHeight: 64,
    letterSpacing: -1,
    color: Colors.primaryLight,
    textAlign: 'center',
  },
  swipeWidget: {
    marginBottom: Spacing.sm,
  },
  swipeWidgetContent: {
    alignItems: 'center',
  },
  swipePage: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainMenuButton: {
    width: BUTTON_WIDTH,
    height: 69,
    borderRadius: 38,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 13.6,
    elevation: 4,
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
    height: 198,
    borderRadius: 38,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 13.6,
    elevation: 4,
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
  achievementsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 23,
    marginBottom: Spacing.lg,
  },
  achievementButton: {
    width: ACHIEVEMENT_BUTTON_SIZE,
    height: ACHIEVEMENT_BUTTON_SIZE,
    borderRadius: 38,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 13.6,
    elevation: 4,
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
