import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Spacing, Colors, Typography, BorderRadius } from '../../../constants/theme';
import { getWorkoutSessions, getUserSettings } from '../../../utils/storage';
import { workoutsToSetRecords, workoutsToSetRecordsForRange } from '../../../utils/workoutMuscles';
import { getWeekStart, calculateWeeklyMuscleVolume, calculateHeatmap } from '../../../utils/weeklyMuscleTracker';
import type { HeatmapData } from '../../../utils/weeklyMuscleTracker';
import { getPeriodRange, type HeatmapPeriod, type CalendarMetric } from '../../../utils/dateBins';
import type { WorkoutSession } from '../../../types';
import { MuscleBodyHeatmap } from '../../../components/MuscleBodyHeatmap';
import { CalendarHeatmap } from '../../../components/heatmaps/CalendarHeatmap';
import { HeatmapControls, type HeatmapView } from '../../../components/heatmaps/HeatmapControls';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';
import { Card } from '../../../components/Card';

export default function ProfileStatisticsScreen() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [weeklyHeatmap, setWeeklyHeatmap] = useState<HeatmapData[]>([]);
  const [animTrigger, setAnimTrigger] = useState(0);

  const [view, setView] = useState<HeatmapView>('Calendar');
  const [period, setPeriod] = useState<HeatmapPeriod>('month');
  const [metric, setMetric] = useState<CalendarMetric>('workouts');
  const [gender, setGender] = useState<'male' | 'female'>('male');

  useEffect(() => {
    getUserSettings().then((s) => {
      if (s.bodyMapGender) setGender(s.bodyMapGender);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      const load = async () => {
        const allSessions = await getWorkoutSessions();
        setSessions(allSessions);
      };
      load();
    }, [])
  );

  const bodyHeatmap = useMemo(() => {
    if (sessions.length === 0) return [];
    if (period === 'week') {
      const weekStart = getWeekStart();
      const setRecords = workoutsToSetRecords(sessions, weekStart);
      const weeklyVolume = calculateWeeklyMuscleVolume(setRecords);
      return calculateHeatmap(weeklyVolume);
    }
    const { start, end } = getPeriodRange(period, sessions);
    const setRecords = workoutsToSetRecordsForRange(sessions, start, end);
    const weeklyVolume = calculateWeeklyMuscleVolume(setRecords);
    return calculateHeatmap(weeklyVolume);
  }, [sessions, period]);

  const hasData = sessions.some((s) => s.isComplete);

  return (
    <View style={styles.container}>
      <HomeGradientBackground />
      <ScrollView
        style={styles.scrollLayer}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
          <HeatmapControls
            view={view}
            onViewChange={setView}
            period={period}
            onPeriodChange={setPeriod}
            metric={metric}
            onMetricChange={setMetric}
          />
        </AnimatedFadeInUp>

        <AnimatedFadeInUp delay={80} duration={380} trigger={animTrigger}>
          {view === 'Calendar' ? (
            hasData ? (
              <Card gradientFill borderRadius={24} style={styles.heatmapCard}>
                <CalendarHeatmap
                  sessions={sessions}
                  period={period}
                  metric={metric}
                  orientation="vertical"
                  maxHeight={380}
                />
              </Card>
            ) : (
              <Card gradientFill borderRadius={24} style={styles.emptyCard}>
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No workouts logged yet</Text>
                  <Text style={styles.emptySubText}>
                    Complete a workout to see your consistency grid
                  </Text>
                </View>
              </Card>
            )
          ) : (
            bodyHeatmap.length > 0 ? (
              <MuscleBodyHeatmap
                heatmapData={bodyHeatmap}
                period={period}
                externalGender={gender}
              />
            ) : (
              <Card gradientFill borderRadius={24} style={styles.emptyCard}>
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No muscle data for this period</Text>
                  <Text style={styles.emptySubText}>
                    Complete a workout to see your muscle map
                  </Text>
                </View>
              </Card>
            )
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
    paddingTop: Spacing.md,
    paddingBottom: 64,
  },
  heatmapCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginTop: 4,
  },
  emptyCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: Typography.body,
    fontWeight: '500',
    color: Colors.primaryLight + '60',
    letterSpacing: -0.2,
  },
  emptySubText: {
    fontSize: Typography.label,
    color: Colors.primaryLight + '35',
    letterSpacing: -0.1,
  },
});
