import React from 'react';
import { useRouter } from 'expo-router';
import YourRoutinesScreen from './(tabs)/workout/your-routines';

/**
 * Root-level modal for Your routines (opened from FAB).
 * Keeps the user on their current tab; closing or starting a routine is explicit.
 */
export default function YourRoutinesModal() {
  const router = useRouter();

  const onStartRoutine = (routine: { id: string }) => {
    router.back();
    setTimeout(() => {
      router.push({ pathname: '/workout', params: { startRoutineId: routine.id } });
    }, 0);
  };

  return <YourRoutinesScreen onStartRoutine={onStartRoutine} />;
}
