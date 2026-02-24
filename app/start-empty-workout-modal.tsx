import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import WorkoutScreen from './(tabs)/workout';
import { generateId } from '../utils/helpers';
import type { WorkoutSession } from '../types';

/**
 * Root-level modal for "Start empty workout" (opened from FAB when not on workout tab).
 * Keeps the user on their current tab; when they finish or leave, modal closes and they stay where they were.
 */
export default function StartEmptyWorkoutModal() {
  const router = useRouter();

  const initialActiveWorkout = useMemo<WorkoutSession>(
    () => ({
      id: generateId(),
      date: new Date().toISOString(),
      name: 'Workout',
      exercises: [],
      duration: 0,
      isComplete: false,
    }),
    []
  );

  return (
    <WorkoutScreen
      asModal
      initialActiveWorkout={initialActiveWorkout}
      onCloseModal={() => router.back()}
    />
  );
}
