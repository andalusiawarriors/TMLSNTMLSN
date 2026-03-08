import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import type { WorkoutSession } from '../types';
import { onWorkoutOriginRoute } from '../utils/fabBridge';
import { startWorkoutActivity, stopWorkoutActivity } from '../lib/liveActivity';

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
  const workoutActivityStartedRef = useRef(false);

  useEffect(() => {
    return onWorkoutOriginRoute((route) => setOriginRoute(route));
  }, []);

  const setActiveWorkout = useCallback((w: WorkoutSession | null) => {
    setActiveWorkoutRaw(w);
    if (w) {
      setMinimized(false);
      // Only start the Live Activity when a workout is first started, not on
      // every set update — otherwise a new activity is created on every tap.
      if (!workoutActivityStartedRef.current) {
        workoutActivityStartedRef.current = true;
        startWorkoutActivity(w.name);
      }
    } else {
      workoutActivityStartedRef.current = false;
      stopWorkoutActivity();
    }
  }, []);

  const currentExerciseName =
    activeWorkout?.exercises[currentExerciseIndex]?.name ?? 'No exercise';

  const workoutStartTime = activeWorkout
    ? new Date(activeWorkout.date).getTime()
    : null;

  const minimizeWorkout = useCallback(() => {
    setMinimized(true);
    // Always navigate away from workout — if origin is workout tab itself, go to nutrition (fitness hub)
    const dest =
      originRoute && originRoute !== '/(tabs)/workout'
        ? originRoute
        : '/(tabs)/nutrition';
    router.replace(dest as any);
  }, [originRoute, router]);

  const expandWorkout = useCallback(() => {
    setMinimized(false);
  }, []);

  const discardWorkout = useCallback(
    (onDiscarded: () => void) => {
      const returnTo = originRoute && originRoute !== '/(tabs)/workout' ? originRoute : '/(tabs)/nutrition';
      workoutActivityStartedRef.current = false;
      stopWorkoutActivity();
      setActiveWorkoutRaw(null);
      setCurrentExerciseIndex(0);
      setMinimized(false);
      setOriginRoute(null);
      router.replace(returnTo as any);
      onDiscarded();
    },
    [originRoute, router]
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
