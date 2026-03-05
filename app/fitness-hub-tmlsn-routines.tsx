import React from 'react';
import { useRouter } from 'expo-router';
import TmlsnRoutinesScreen from './workout/tmlsn-routines';

export default function FitnessHubTmlsnRoutinesPage() {
  const router = useRouter();

  const onStartRoutine = (split: { id: string }) => {
    router.replace({ pathname: '/(tabs)/workout', params: { startSplitId: split.id } } as any);
  };

  return <TmlsnRoutinesScreen onStartRoutine={onStartRoutine} />;
}
