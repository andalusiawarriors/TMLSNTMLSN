import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import type { WorkoutSession } from '../types';
import { onWorkoutOriginRoute } from '../utils/fabBridge';

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
  originRoute: string | null;
  setOriginRoute: (route: string | null) => void;
};

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null);

export function ActiveWorkoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeWorkout, setActiveWorkoutRaw] = useState<WorkoutSession | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [originRoute, setOriginRoute] = useState<string | null>(null);

  useEffect(() => {
    return onWorkoutOriginRoute((route) => setOriginRoute(route));
  }, []);

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
    if (originRoute && originRoute !== '/(tabs)/workout') {
      router.replace(originRoute as any);
    }
  }, [originRoute, router]);

  const expandWorkout = useCallback(() => {
    setMinimized(false);
    router.replace('/(tabs)/workout');
  }, [router]);

  const discardWorkout = useCallback(
    (onDiscarded: () => void) => {
      setActiveWorkoutRaw(null);
      setCurrentExerciseIndex(0);
      setMinimized(false);
      setOriginRoute(null);
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
    originRoute,
    setOriginRoute,
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
