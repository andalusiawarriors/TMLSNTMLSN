import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Spacing, Colors, Typography } from '../../../constants/theme';
import { getWorkoutSessions } from '../../../utils/storage';
import { workoutsToSetRecords } from '../../../utils/workoutMuscles';
import { getWeekStart, calculateWeeklyMuscleVolume, calculateHeatmap } from '../../../utils/weeklyMuscleTracker';
import { MuscleBodyHeatmap } from '../../../components/MuscleBodyHeatmap';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';

export default function StatisticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const [weeklyHeatmap, setWeeklyHeatmap] = useState<ReturnType<typeof calculateHeatmap>>([]);
  const [hasSetRecords, setHasSetRecords] = useState(false);
  const [animTrigger, setAnimTrigger] = useState(0);

  useEffect(() => {
    if (params?.returnTo !== 'profile') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/profile');
      return true;
    });
    return () => sub.remove();
  }, [params?.returnTo, router]);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      const load = async () => {
        const allSessions = await getWorkoutSessions();
        const weekStart = getWeekStart();
        const setRecords = workoutsToSetRecords(allSessions, weekStart);
        setHasSetRecords(setRecords.length > 0);
        const weeklyVolume = calculateWeeklyMuscleVolume(setRecords);
        setWeeklyHeatmap(calculateHeatmap(weeklyVolume));
      };
      load();
    }, [])
  );

  return (
    <View style={styles.container}>
      <HomeGradientBackground />
      <ScrollView
        style={styles.scrollLayer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
          {hasSetRecords ? (
            <MuscleBodyHeatmap heatmapData={weeklyHeatmap} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No workout data for this week</Text>
            </View>
          )}
        </AnimatedFadeInUp>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  scrollLayer: {
    zIndex: 2,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 48,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.body,
    color: Colors.primaryLight + '80',
  },
});
