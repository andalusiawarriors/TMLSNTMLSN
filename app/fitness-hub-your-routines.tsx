import React from 'react';
import { useRouter } from 'expo-router';
import YourRoutinesScreen from './workout/your-routines';

export default function FitnessHubYourRoutinesPage() {
  const router = useRouter();

  const onStartRoutine = (routine: { id: string }) => {
    router.replace({ pathname: '/(tabs)/workout', params: { startRoutineId: routine.id } } as any);
  };

  return <YourRoutinesScreen onStartRoutine={onStartRoutine} />;
}
