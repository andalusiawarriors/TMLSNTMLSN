// ============================================================
// TMLSN — Full-screen workout heatmap page (opened from Progress → Fitness)
// ============================================================

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Spacing, Colors, Glass } from '../constants/theme';
import { HomeGradientBackground } from '../components/HomeGradientBackground';
import { GlassCard } from '../components/ui/GlassCard';
import { GlassPill } from '../components/ui/GlassPill';
import { CalendarHeatmap } from '../components/heatmaps/CalendarHeatmap';
import { getWorkoutSessions } from '../utils/storage';
import type { WorkoutSession } from '../types';
import type { HeatmapPeriod, CalendarMetric } from '../utils/dateBins';

const HEATMAP_HEIGHT = 420;

export default function ProgressHeatmapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [heatPeriod, setHeatPeriod] = useState<HeatmapPeriod>('month');
  const [heatMetric, setHeatMetric] = useState<CalendarMetric>('workouts');

  useFocusEffect(
    useCallback(() => {
      getWorkoutSessions().then(setSessions);
    }, [])
  );

  const hasData = sessions.some((s) => s.isComplete);

  return (
    <View style={styles.wrapper}>
      <HomeGradientBackground />
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.pageTitle}>workout heatmap.</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <GlassCard style={styles.card}>
          {/* Period + metric pills */}
          <View style={styles.heatControls}>
            <View style={styles.heatPillRow}>
              {(['week', 'month', 'year', 'all'] as const).map((p) => (
                <GlassPill
                  key={p}
                  label={p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                  size="small"
                  selected={heatPeriod === p}
                  onPress={() => setHeatPeriod(p)}
                  style={styles.heatPill}
                />
              ))}
            </View>
            <View style={styles.heatPillRow}>
              {(['workouts', 'volume'] as const).map((m) => (
                <GlassPill
                  key={m}
                  label={m === 'workouts' ? 'Workouts' : 'Volume'}
                  size="small"
                  selected={heatMetric === m}
                  onPress={() => setHeatMetric(m)}
                  style={styles.heatPill}
                />
              ))}
            </View>
          </View>

          <View style={styles.heatContainer}>
            {hasData ? (
              <CalendarHeatmap
                sessions={sessions}
                period={heatPeriod}
                metric={heatMetric}
                orientation="vertical"
                maxHeight={HEATMAP_HEIGHT}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No workouts logged yet</Text>
                <Text style={styles.emptySubText}>
                  Complete a workout to see your activity grid
                </Text>
              </View>
            )}
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    zIndex: 2,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backBtnPressed: {
    opacity: 0.7,
  },
  backText: {
    color: Colors.primaryLight,
    fontSize: 15,
    fontWeight: '500',
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: 'rgba(198, 198, 198, 0.90)',
    marginTop: 4,
    marginLeft: 4,
  },
  scroll: {
    flex: 1,
    zIndex: 2,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  card: {
    marginVertical: 0,
  },
  heatControls: {
    gap: 8,
    marginBottom: 14,
  },
  heatPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heatPill: {
    flex: 1,
  },
  heatContainer: {
    minHeight: HEATMAP_HEIGHT,
  },
  emptyState: {
    flex: 1,
    minHeight: HEATMAP_HEIGHT - 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: Glass.textSecondary,
    letterSpacing: -0.2,
  },
  emptySubText: {
    fontSize: 13,
    color: Colors.primaryLight + '40',
    letterSpacing: -0.1,
  },
});
