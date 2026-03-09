import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import type { WorkoutSession } from '../types';
import { startWorkoutActivity, stopWorkoutActivity } from '../lib/liveActivity';
import { useAuth } from './AuthContext';
import {
  clearActiveWorkoutDraft,
  getActiveWorkoutDraft,
  saveActiveWorkoutDraft,
} from '../utils/storage';

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
  const { user, isLoading } = useAuth();
  const [activeWorkout, setActiveWorkoutRaw] = useState<WorkoutSession | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [originRoute, setOriginRoute] = useState<string | null>(null);
  const workoutActivityStartedRef = useRef(false);
  const restorePromptedForKeyRef = useRef<string | null>(null);
  const previousActiveWorkoutIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    const draftUserKey = user?.id ?? 'anonymous';
    if (isLoading || activeWorkout || restorePromptedForKeyRef.current === draftUserKey) return;
    restorePromptedForKeyRef.current = draftUserKey;

    let cancelled = false;
    (async () => {
      const draft = await getActiveWorkoutDraft(user?.id);
      if (cancelled || !draft) return;

      const savedAtMs = Date.parse(draft.savedAt);
      if (!Number.isFinite(savedAtMs) || Date.now() - savedAtMs > 7 * 24 * 60 * 60 * 1000) {
        await clearActiveWorkoutDraft(user?.id);
        return;
      }

      Alert.alert(
        'Resume workout?',
        `Restore "${draft.workout.name || 'Workout'}" from your last session?`,
        [
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              void clearActiveWorkoutDraft(user?.id);
            },
          },
          {
            text: 'Resume',
            onPress: () => {
              setCurrentExerciseIndex(
                Math.max(
                  0,
                  Math.min(draft.currentExerciseIndex ?? 0, Math.max((draft.workout.exercises?.length ?? 1) - 1, 0))
                )
              );
              setActiveWorkout(draft.workout);
              router.replace('/(tabs)/workout' as any);
            },
          },
        ]
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkout, isLoading, setActiveWorkout, user?.id]);

  useEffect(() => {
    const previousId = previousActiveWorkoutIdRef.current;
    const nextId = activeWorkout?.id ?? null;
    if (previousId && !nextId) {
      void clearActiveWorkoutDraft(user?.id);
    }
    previousActiveWorkoutIdRef.current = nextId;
  }, [activeWorkout?.id, user?.id]);

  useEffect(() => {
    if (!activeWorkout) return;
    const timeout = setTimeout(() => {
      void saveActiveWorkoutDraft(
        {
          version: 1,
          savedAt: new Date().toISOString(),
          workout: activeWorkout,
          currentExerciseIndex,
        },
        user?.id
      );
    }, 1500);
    return () => clearTimeout(timeout);
  }, [activeWorkout, currentExerciseIndex, user?.id]);

  useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => {
      void saveActiveWorkoutDraft(
        {
          version: 1,
          savedAt: new Date().toISOString(),
          workout: activeWorkout,
          currentExerciseIndex,
        },
        user?.id
      );
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeWorkout, currentExerciseIndex, user?.id]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (!activeWorkout) return;
      if (state === 'inactive' || state === 'background') {
        void saveActiveWorkoutDraft(
          {
            version: 1,
            savedAt: new Date().toISOString(),
            workout: activeWorkout,
            currentExerciseIndex,
          },
          user?.id
        );
      }
    });
    return () => sub.remove();
  }, [activeWorkout, currentExerciseIndex, user?.id]);

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
