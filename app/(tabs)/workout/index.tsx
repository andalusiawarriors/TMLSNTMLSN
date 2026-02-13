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
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
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

// EB Garamond – same as Calorie tab
const Font = {
  regular: 'EBGaramond_400Regular',
  medium: 'EBGaramond_500Medium',
  semiBold: 'EBGaramond_600SemiBold',
  bold: 'EBGaramond_700Bold',
  extraBold: 'EBGaramond_800ExtraBold',
} as const;

const HeadingLetterSpacing = -1;

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
  const [editingRoutine, setEditingRoutine] = useState<{
    name: string;
    exercises: { id: string; name: string; restTimer: number }[];
  }>({ name: 'New Routine', exercises: [] });
  
  // Rest Timer State
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [restTimerNotificationId, setRestTimerNotificationId] = useState<string | null>(null);

  // Exercise Entry State
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    loadWorkouts();
  }, []);

  useEffect(() => {
    if (!activeWorkout) {
      setElapsedSeconds(0);
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
    if (!activeWorkout || !weight || !reps) {
      Alert.alert('Error', 'Please enter weight and reps');
      return;
    }

    const exercise = activeWorkout.exercises[exerciseIndex];
    if (!exercise) return;

    const newSet: Set = {
      id: generateId(),
      weight: parseFloat(weight),
      reps: parseInt(reps),
      completed: true,
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

    setWeight('');
    setReps('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      setWeight('');
      setReps('');
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
        <View style={styles.pageHeaderRow}>
          <Image
            source={require('../../assets/tmlsn-calories-logo.png')}
            style={styles.pageHeaderLogo}
            resizeMode="contain"
          />
          <Text style={styles.pageHeading}>
            WORKOUT TRACKER
          </Text>
        </View>
        {/* + Start Empty Workout – primary CTA */}
        <TouchableOpacity
          style={styles.startEmptyButton}
          onPress={startFreeformWorkout}
          activeOpacity={0.8}
        >
          <Text style={styles.startEmptyButtonText}>+ Start Empty Workout</Text>
        </TouchableOpacity>

        {/* Routines section */}
        <View style={styles.routinesHeader}>
          <Text style={styles.routinesTitle}>Routines</Text>
        </View>

        {/* New Routine – same thickness as Start Empty Workout, + at start of text */}
        <TouchableOpacity
          style={styles.newRoutineButton}
          onPress={openRoutineBuilder}
          activeOpacity={0.8}
        >
          <Text style={styles.newRoutineButtonText}>+ New Routine</Text>
        </TouchableOpacity>

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

        {/* TMLSN workouts – dropdown under Routines */}
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setTmlsnExpanded(!tmlsnExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownChevron}>{tmlsnExpanded ? '▼' : '▶'}</Text>
          <Text style={styles.dropdownTitle}>TMLSN workouts ({TMLSN_SPLITS.length})</Text>
        </TouchableOpacity>
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
                  <Text style={styles.tmlsnRoutineStartButtonText}>Start Routine</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* My Routines – collapsible; saved routines from builder */}
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setMyRoutinesExpanded(!myRoutinesExpanded)}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownChevron}>{myRoutinesExpanded ? '▼' : '▶'}</Text>
          <Text style={styles.dropdownTitle}>My Routines ({savedRoutines.length})</Text>
        </TouchableOpacity>
        {myRoutinesExpanded && (
          <View style={styles.dropdownList}>
            {savedRoutines.length === 0 ? (
              <Text style={styles.emptyText}>No routines yet. Create one with New Routine.</Text>
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
            {/* Log Workout – top bar: timer, down arrow (back), Finish */}
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
                <Text style={styles.logTitle}>Log Workout</Text>
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

            {/* Summary: Duration, Volume, Sets */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Duration</Text>
                <Text style={styles.summaryValue}>{formatElapsed(elapsedSeconds)}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Volume</Text>
                <Text style={styles.summaryValue}>{totalVolume} lbs</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Sets</Text>
                <Text style={styles.summaryValue}>{totalSets}</Text>
              </View>
            </View>

            {/* Global rest timer (when active) */}
            {restTimerActive && restTimeRemaining > 0 && (
              <View style={styles.restTimerBanner}>
                <Text style={styles.restTimerBannerIcon}>🕐</Text>
                <Text style={styles.restTimerBannerText}>
                  Rest: {formatDuration(restTimeRemaining)}
                </Text>
                <TouchableOpacity onPress={skipRestTimer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.restTimerBannerSkip}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Exercise blocks – one card per exercise */}
            {activeWorkout.exercises.map((exercise, exerciseIndex) => (
              <Card key={exercise.id} style={styles.exerciseBlock}>
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
                    <Text style={styles.setTableHeaderCell}>SET</Text>
                    <Text style={styles.setTableHeaderCell}>PREVIOUS</Text>
                    <Text style={styles.setTableHeaderCell}>LBS</Text>
                    <Text style={styles.setTableHeaderCell}>REPS</Text>
                    <Text style={styles.setTableHeaderCell}>✓</Text>
                  </View>
                  {exercise.sets.map((set, setIndex) => (
                    <View key={set.id} style={styles.setTableRow}>
                      <Text style={styles.setTableCell}>{setIndex + 1}</Text>
                      <Text style={styles.setTableCell}>
                        {setIndex > 0
                          ? `${exercise.sets[setIndex - 1].weight}×${exercise.sets[setIndex - 1].reps}`
                          : '—'}
                      </Text>
                      <Text style={styles.setTableCell}>{set.weight}</Text>
                      <Text style={styles.setTableCell}>{set.reps}</Text>
                      <Text style={styles.setTableCell}>✓</Text>
                    </View>
                  ))}
                </View>

                {/* Add set row – weight, reps, Add Set */}
                <View style={styles.addSetRow}>
                  <View style={styles.addSetInputWrap}>
                    <Text style={styles.addSetLabel}>LBS</Text>
                    <Input
                      value={weight}
                      onChangeText={setWeight}
                      keyboardType="numeric"
                      placeholder="0"
                      containerStyle={styles.addSetInput}
                      fontFamily={Font.regular}
                    />
                  </View>
                  <View style={styles.addSetInputWrap}>
                    <Text style={styles.addSetLabel}>REPS</Text>
                    <Input
                      value={reps}
                      onChangeText={setReps}
                      keyboardType="numeric"
                      placeholder="0"
                      containerStyle={styles.addSetInput}
                      fontFamily={Font.regular}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.addSetButtonBlock}
                    onPress={() => addSet(exerciseIndex)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.addSetButtonBlockText}>+ Add Set</Text>
                  </TouchableOpacity>
                </View>
              </Card>
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
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startEmptyButtonText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
    textAlign: 'center',
  },
  routinesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  routinesTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
  },
  newRoutineButton: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newRoutineButtonText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
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
  },
  bubbleButtonIcon: {
    fontFamily: Font.regular,
    fontSize: 20,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  bubbleButtonLabel: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
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
  },
  infoBubbleIcon: {
    fontSize: 16,
  },
  infoBubbleText: {
    flex: 1,
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: '#1a1a1a',
  },
  infoBubbleClose: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: '#1a1a1a',
    padding: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
    marginBottom: Spacing.sm,
  },
  splitCardBlock: {
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '20',
  },
  splitCardName: {
    fontFamily: Font.bold,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
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
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  splitExerciseRest: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
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
  },
  addExerciseToRoutineText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
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
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  dropdownTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.body,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
  },
  dropdownList: {
    marginLeft: Spacing.sm,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: Colors.primaryLight + '30',
  },
  tmlsnRoutineCard: {
    backgroundColor: Colors.primaryDarkLighter,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
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
    fontFamily: Font.regular,
    fontSize: Typography.label,
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
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: '#2f3031',
    fontWeight: Typography.weights.semiBold,
  },
  routineItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight + '15',
  },
  routineItemName: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
    marginBottom: 2,
  },
  routineItemDetail: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pageHeaderLogo: {
    height: (Typography.h2 + 10) * 1.2 * 1.1,
    width: (Typography.h2 + 10) * 1.2 * 1.1,
  },
  pageHeading: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2 * 1.2 * 1.1,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
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
  modalContent: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
    marginBottom: Spacing.lg,
    letterSpacing: HeadingLetterSpacing,
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
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    lineHeight: Typography.dataValue,
  },
  logTimer: {
    fontFamily: Font.bold,
    fontSize: Typography.dataValue,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
  },
  logTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
  },
  finishButton: {
    backgroundColor: Colors.primaryDarkLighter,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  finishButtonText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primaryLight + '15',
    borderRadius: BorderRadius.md,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryLabel: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    fontFamily: Font.bold,
    fontSize: Typography.dataValue,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
  },
  restTimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  restTimerBannerIcon: {
    fontSize: 16,
  },
  restTimerBannerText: {
    flex: 1,
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  restTimerBannerSkip: {
    fontFamily: Font.semiBold,
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  exerciseBlock: {
    marginBottom: Spacing.lg,
  },
  exerciseBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  exerciseBlockName: {
    fontFamily: Font.bold,
    fontSize: Typography.h2,
    color: Colors.primaryLight,
    letterSpacing: HeadingLetterSpacing,
    flex: 1,
  },
  exerciseBlockMenu: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    padding: Spacing.xs,
  },
  notesPlaceholder: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
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
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  setTable: {
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '25',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  setTableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.primaryLight + '20',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  setTableHeaderCell: {
    fontFamily: Font.semiBold,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    flex: 1,
    textAlign: 'center',
  },
  setTableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.primaryLight + '15',
  },
  setTableCell: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    flex: 1,
    textAlign: 'center',
  },
  addSetRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  addSetInputWrap: {
    flex: 1,
  },
  addSetLabel: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  addSetInput: {
    marginBottom: 0,
  },
  addSetButtonBlock: {
    backgroundColor: Colors.primaryDarkLighter,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    minWidth: 100,
  },
  addSetButtonBlockText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
});
