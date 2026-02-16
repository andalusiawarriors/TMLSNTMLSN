import React, { useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Spacing, Colors } from '../../../constants/theme';
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
    <View style={styles.container}>
      <Image
        source={require('../../../assets/home-background.png')}
        style={styles.homeBackgroundImage}
        resizeMode="cover"
      />
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
  homeBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  scrollLayer: {
    zIndex: 2,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 48,
  },
});
