import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../../context/ThemeContext';
import { useActiveWorkout } from '../../../context/ActiveWorkoutContext';
import { getWorkoutSessions } from '../../../utils/storage';
import { WorkoutSession } from '../../../types';
import { WorkoutCore } from '../../../components/WorkoutCore';

function WorkoutTabRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(tabs)/nutrition' as any);
  }, [router]);
  return null;
}

export type WorkoutScreenModalProps = {
  asModal?: boolean;
  initialActiveWorkout?: WorkoutSession | null;
  onCloseModal?: () => void;
};

export default function WorkoutScreen({
  asModal = false,
  initialActiveWorkout = null,
  onCloseModal,
}: WorkoutScreenModalProps = {}) {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeWorkout } = useActiveWorkout();
  const { startSplitId, startRoutineId, startEmpty } = useLocalSearchParams<{
    startSplitId?: string;
    startRoutineId?: string;
    startEmpty?: string;
  }>();
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [paramsReady, setParamsReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setParamsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useFocusEffect(
    useCallback(() => {
      getWorkoutSessions().then((all) => setRecentSessions(all.slice(0, 10)));
    }, [])
  );

  const handleFinish = async (payload: WorkoutSession) => {
    router.push({ pathname: '/workout-save', params: { sessionId: payload.id } });
  };

  const shouldRedirect =
    paramsReady &&
    !asModal &&
    !activeWorkout &&
    !startSplitId &&
    !startRoutineId &&
    startEmpty !== '1';

  return (
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <Stack.Screen options={{ gestureEnabled: !activeWorkout }} />
      {shouldRedirect && <WorkoutTabRedirect />}
      <WorkoutCore
        onFinish={handleFinish}
        useStickyHeader={true}
        enableReorder={true}
        enableStatsModal={true}
        enableRpeBump={false}
        recentSessions={recentSessions}
        expandOnFocus={true}
        asModal={asModal}
        initialActiveWorkout={initialActiveWorkout}
        onCloseModal={onCloseModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
  },
});
