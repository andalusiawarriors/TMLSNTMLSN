import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Spacing, Colors } from '../../../constants/theme';
import { useTheme } from '../../../context/ThemeContext';
import { getWorkoutSessions } from '../../../utils/storage';
import { workoutsToSetRecords } from '../../../utils/workoutMuscles';
import { getWeekStart, calculateWeeklyMuscleVolume, calculateHeatmap } from '../../../utils/weeklyMuscleTracker';
import { MuscleBodyHeatmap } from '../../../components/MuscleBodyHeatmap';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';

export default function StatisticsScreen() {
  const { colors } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.primaryDark }]}>
      <HomeGradientBackground />
      <ScrollView
        style={styles.scrollLayer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
          <MuscleBodyHeatmap heatmapData={weeklyHeatmap} />
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
});
