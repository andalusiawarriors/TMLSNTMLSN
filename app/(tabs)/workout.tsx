import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
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
} from '../../utils/storage';
import { WorkoutSession, Exercise, Set, WorkoutSplit } from '../../types';
import { generateId, formatDuration } from '../../utils/helpers';
import { scheduleRestTimerNotification } from '../../utils/notifications';

export default function WorkoutScreen() {
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSession[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutSession | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showSplitSelection, setShowSplitSelection] = useState(false);
  const [showExerciseEntry, setShowExerciseEntry] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  // Rest Timer State
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [restTimerNotificationId, setRestTimerNotificationId] = useState<string | null>(null);

  // Exercise Entry State
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  useEffect(() => {
    loadWorkouts();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
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

  const startFreeformWorkout = () => {
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

  const addSet = () => {
    if (!activeWorkout || !weight || !reps) {
      Alert.alert('Error', 'Please enter weight and reps');
      return;
    }

    const currentExercise = activeWorkout.exercises[currentExerciseIndex];
    if (!currentExercise) return;

    const newSet: Set = {
      id: generateId(),
      weight: parseFloat(weight),
      reps: parseInt(reps),
      completed: true,
    };

    const updatedExercise = {
      ...currentExercise,
      sets: [...currentExercise.sets, newSet],
    };

    const updatedExercises = [...activeWorkout.exercises];
    updatedExercises[currentExerciseIndex] = updatedExercise;

    setActiveWorkout({
      ...activeWorkout,
      exercises: updatedExercises,
    });

    // Start rest timer if enabled
    if (restTimerActive && currentExercise.restTimer) {
      startRestTimer(currentExercise.restTimer, updatedExercise.sets.length);
    }

    // Clear inputs
    setWeight('');
    setReps('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const startRestTimer = async (seconds: number, setNumber: number) => {
    setRestTimeRemaining(seconds);
    setRestTimerActive(true);
    
    // Schedule notification
    try {
      const exerciseName = activeWorkout?.exercises[currentExerciseIndex]?.name || 'Exercise';
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

  const currentExercise = activeWorkout?.exercises[currentExerciseIndex];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        {!activeWorkout ? (
          <>
            {/* Workout Options */}
            <Card>
              <Text style={styles.cardTitle}>Start Workout</Text>
              <Button
                title="Choose TMLSN Split"
                onPress={() => setShowSplitSelection(true)}
                style={styles.optionButton}
              />
              <Button
                title="Start Freeform Workout"
                onPress={startFreeformWorkout}
                variant="secondary"
                style={styles.optionButton}
              />
            </Card>

            {/* Recent Workouts */}
            <Card>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Workouts</Text>
                <TouchableOpacity onPress={() => setShowHistory(true)}>
                  <Text style={styles.linkText}>View All →</Text>
                </TouchableOpacity>
              </View>
              {recentWorkouts.length === 0 ? (
                <Text style={styles.emptyText}>No workouts logged yet</Text>
              ) : (
                recentWorkouts.slice(0, 3).map((workout) => (
                  <View key={workout.id} style={styles.workoutItem}>
                    <Text style={styles.workoutName}>{workout.name}</Text>
                    <Text style={styles.workoutDetail}>
                      {workout.exercises.length} exercises • {workout.duration} min
                    </Text>
                    <Text style={styles.workoutDate}>
                      {new Date(workout.date).toLocaleDateString()}
                    </Text>
                  </View>
                ))
              )}
            </Card>
          </>
        ) : (
          <>
            {/* Active Workout */}
            <Card>
              <Text style={styles.workoutName}>{activeWorkout.name}</Text>
              <Text style={styles.progressText}>
                Exercise {currentExerciseIndex + 1} of {activeWorkout.exercises.length}
              </Text>
            </Card>

            {currentExercise && (
              <Card>
                <Text style={styles.exerciseName}>{currentExercise.name}</Text>
                <Text style={styles.setsCompleted}>
                  Sets Completed: {currentExercise.sets.length}
                </Text>

                {/* Previous Sets */}
                {currentExercise.sets.map((set, index) => (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setText}>Set {index + 1}</Text>
                    <Text style={styles.setText}>
                      {set.weight} lbs × {set.reps} reps
                    </Text>
                  </View>
                ))}

                {/* Current Set Entry */}
                <View style={styles.setEntry}>
                  <Input
                    label="Weight (lbs)"
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="numeric"
                    placeholder="135"
                    containerStyle={styles.setInput}
                  />
                  <Input
                    label="Reps"
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="numeric"
                    placeholder="10"
                    containerStyle={styles.setInput}
                  />
                </View>

                <Button title="Add Set" onPress={addSet} style={styles.addSetButton} />

                {/* Rest Timer Toggle */}
                <TouchableOpacity
                  style={styles.timerToggle}
                  onPress={() => setRestTimerActive(!restTimerActive)}
                >
                  <Text style={styles.timerToggleText}>
                    Rest Timer: {restTimerActive ? 'ON' : 'OFF'}
                  </Text>
                  {restTimerActive && currentExercise.restTimer && (
                    <Text style={styles.timerDuration}>
                      ({formatDuration(currentExercise.restTimer)})
                    </Text>
                  )}
                </TouchableOpacity>

                <Button
                  title={
                    currentExerciseIndex < activeWorkout.exercises.length - 1
                      ? 'Next Exercise'
                      : 'Finish Workout'
                  }
                  onPress={nextExercise}
                  variant="secondary"
                  style={styles.nextButton}
                />
              </Card>
            )}

            {/* Rest Timer Display */}
            {restTimerActive && restTimeRemaining > 0 && (
              <Card style={styles.restTimerCard}>
                <Text style={styles.restTimerTitle}>Rest Timer</Text>
                <Text style={styles.restTimerTime}>{formatDuration(restTimeRemaining)}</Text>
                <Button
                  title="Skip Rest"
                  onPress={skipRestTimer}
                  variant="danger"
                  style={styles.skipButton}
                />
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {/* Split Selection Modal */}
      <Modal
        visible={showSplitSelection}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSplitSelection(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Workout Split</Text>
            <ScrollView>
              {TMLSN_SPLITS.map((split) => (
                <TouchableOpacity
                  key={split.id}
                  style={styles.splitOption}
                  onPress={() => startWorkoutFromSplit(split)}
                >
                  <Text style={styles.splitName}>{split.name}</Text>
                  <Text style={styles.splitDetail}>
                    {split.exercises.length} exercises
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              title="Cancel"
              onPress={() => setShowSplitSelection(false)}
              variant="secondary"
              style={styles.cancelButton}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  contentContainer: {
    padding: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  linkText: {
    fontSize: Typography.body,
    color: Colors.accentBlue,
    fontWeight: Typography.weights.medium,
  },
  optionButton: {
    marginBottom: Spacing.sm,
  },
  emptyText: {
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
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  workoutDetail: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  workoutDate: {
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  progressText: {
    fontSize: Typography.body,
    color: Colors.accentBlue,
    marginTop: Spacing.xs,
  },
  exerciseName: {
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  setsCompleted: {
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
    fontSize: Typography.body,
    color: Colors.white,
    fontWeight: Typography.weights.semiBold,
  },
  timerDuration: {
    fontSize: Typography.body,
    color: Colors.accentBlue,
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
    fontSize: Typography.h2,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    textAlign: 'center',
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
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.white,
    marginBottom: Spacing.lg,
  },
  splitOption: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.primaryLight + '10',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  splitName: {
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  splitDetail: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  cancelButton: {
    marginTop: Spacing.lg,
  },
});
