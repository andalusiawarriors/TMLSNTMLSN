import React from 'react';
import { useRouter } from 'expo-router';
import TmlsnRoutinesScreen from './(tabs)/workout/tmlsn-routines';

/**
 * Root-level modal for TMLSN routines (opened from FAB).
 * Keeps the user on their current tab; closing or starting a routine is explicit.
 */
export default function TmlsnRoutinesModal() {
  const router = useRouter();

  const onStartRoutine = (split: { id: string }) => {
    router.back();
    setTimeout(() => {
      router.push({ pathname: '/workout', params: { startSplitId: split.id } });
    }, 0);
  };

  return <TmlsnRoutinesScreen onStartRoutine={onStartRoutine} />;
}
