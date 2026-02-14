import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Spacing } from '../../../constants/theme';
import { getWorkoutSessions } from '../../../utils/storage';
import { workoutsToSetRecords } from '../../../utils/workoutMuscles';
import { getWeekStart, calculateWeeklyMuscleVolume, calculateHeatmap } from '../../../utils/weeklyMuscleTracker';
import { MuscleBodyHeatmap } from '../../../components/MuscleBodyHeatmap';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';

export default function StatisticsScreen() {
  const [weeklyHeatmap, setWeeklyHeatmap] = useState<ReturnType<typeof calculateHeatmap>>([]);
  const [animTrigger, setAnimTrigger] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      const load = async () => {
        const allSessions = await getWorkoutSessions();
        const weekStart = getWeekStart();
        const setRecords = workoutsToSetRecords(allSessions, weekStart);
        const weeklyVolume = calculateWeeklyMuscleVolume(setRecords);
        setWeeklyHeatmap(calculateHeatmap(weeklyVolume));
      };
      load();
    }, [])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
        <MuscleBodyHeatmap heatmapData={weeklyHeatmap} />
      </AnimatedFadeInUp>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 48,
  },
});
