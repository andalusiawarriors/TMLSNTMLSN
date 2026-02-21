import React, { createContext, useCallback, useContext, useState } from 'react';
import { useRouter } from 'expo-router';
import type { WorkoutSession } from '../types';

type ActiveWorkoutContextValue = {
  activeWorkout: WorkoutSession | null;
  currentExerciseIndex: number;
  setActiveWorkout: (w: WorkoutSession | null) => void;
  setCurrentExerciseIndex: (i: number) => void;
  currentExerciseName: string;
  workoutStartTime: number | null;
  minimized: boolean;
  minimizeWorkout: () => void;
  expandWorkout: () => void;
  discardWorkout: (onDiscarded: () => void) => void;
};

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null);

export function ActiveWorkoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeWorkout, setActiveWorkoutRaw] = useState<WorkoutSession | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);

  const setActiveWorkout = useCallback((w: WorkoutSession | null) => {
    setActiveWorkoutRaw(w);
    if (w) setMinimized(false);
  }, []);

  const currentExerciseName =
    activeWorkout?.exercises[currentExerciseIndex]?.name ?? 'No exercise';

  const workoutStartTime = activeWorkout
    ? new Date(activeWorkout.date).getTime()
    : null;

  const minimizeWorkout = useCallback(() => {
    setMinimized(true);
  }, []);

  const expandWorkout = useCallback(() => {
    setMinimized(false);
    router.replace('/(tabs)/workout');
  }, [router]);

  const discardWorkout = useCallback(
    (onDiscarded: () => void) => {
      setActiveWorkoutRaw(null);
      setCurrentExerciseIndex(0);
      setMinimized(false);
      onDiscarded();
    },
    []
  );

  const value: ActiveWorkoutContextValue = {
    activeWorkout,
    currentExerciseIndex,
    setActiveWorkout,
    setCurrentExerciseIndex,
    currentExerciseName,
    workoutStartTime,
    minimized,
    minimizeWorkout,
    expandWorkout,
    discardWorkout,
  };

  return (
    <ActiveWorkoutContext.Provider value={value}>
      {children}
    </ActiveWorkoutContext.Provider>
  );
}

export function useActiveWorkout(): ActiveWorkoutContextValue {
  const ctx = useContext(ActiveWorkoutContext);
  if (!ctx) throw new Error('useActiveWorkout must be used within ActiveWorkoutProvider');
  return ctx;
}
