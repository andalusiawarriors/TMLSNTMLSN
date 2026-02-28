import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Spacing, Colors } from '../../../constants/theme';
import { AnimatedFadeInUp } from '../../../components/AnimatedFadeInUp';
import { InteractiveGlassWrapper } from '../../../components/ui/InteractiveGlassWrapper';
import { LiquidGlassSegmented } from '../../../components/ui/liquidGlass';
import { HomeGradientBackground } from '../../../components/HomeGradientBackground';
import { getWorkoutSessions } from '../../../utils/storage';
import type { WorkoutSession } from '../../../types';
import {
  type HeatmapPeriod,
  getPeriodRange,
  aggregateSessionsByDay,
} from '../../../utils/dateBins';

const SCREEN_WIDTH = Dimensions.get('window').width;
const OUTER_PAD = 20;
const GRID_GAP = 14;
const CARD_SIZE = Math.floor((SCREEN_WIDTH - OUTER_PAD * 2 - GRID_GAP) / 2);
const TILE_RADIUS = 38;
const SEGMENT_CONTROL_WIDTH = SCREEN_WIDTH - OUTER_PAD * 2;

interface TileConfig {
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

function TileCard({
  item,
  index,
  animTrigger,
}: {
  item: TileConfig;
  index: number;
  animTrigger: number;
}) {
  const router = useRouter();

  const onRelease = useCallback(() => {
    router.push(item.route as any);
  }, [item.route, router]);

  return (
    <AnimatedFadeInUp delay={50 + index * 45} duration={440} trigger={animTrigger}>
      <Animated.View layout={Layout.springify().damping(20).stiffness(260)} style={styles.tileShadow}>
        <InteractiveGlassWrapper
          width={CARD_SIZE}
          height={CARD_SIZE}
          borderRadius={TILE_RADIUS}
          onRelease={onRelease}
        >
          <View style={styles.tileGlass}>
            <BlurView
              intensity={26}
              tint="dark"
              style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]}
            />
            <View
              style={[StyleSheet.absoluteFillObject, styles.tileFillOverlay, { borderRadius: TILE_RADIUS }]}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.07)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.85, y: 0.85 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.18 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.22)']}
              start={{ x: 0.5, y: 0.55 }}
              end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TILE_RADIUS }]}
              pointerEvents="none"
            />
            <View
              style={[StyleSheet.absoluteFillObject, styles.tileBorderRim, { borderRadius: TILE_RADIUS }]}
              pointerEvents="none"
            />
            <View style={styles.tileContent}>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.tileSubtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>
          </View>
        </InteractiveGlassWrapper>
      </Animated.View>
    </AnimatedFadeInUp>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  const [animTrigger, setAnimTrigger] = useState(0);
  const [progressSegment, setProgressSegment] = useState<'Nutrition' | 'Fitness'>('Nutrition');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);

  const heatPeriod: HeatmapPeriod = 'month';

  useFocusEffect(
    useCallback(() => {
      setAnimTrigger((t) => t + 1);
      getWorkoutSessions().then(setSessions);
    }, [])
  );

  const { activeDays, totalWorkouts, periodLabel } = useMemo(() => {
    const { start, end } = getPeriodRange(heatPeriod, sessions);
    const workoutsMap = aggregateSessionsByDay(sessions, 'workouts');
    let ad = 0;
    let tw = 0;
    for (const [dateKey, v] of workoutsMap) {
      const d = new Date(dateKey + 'T12:00:00');
      if (d >= start && d < end) {
        if (v > 0) ad += 1;
        tw += v;
      }
    }
    const labels: Record<HeatmapPeriod, string> = {
      week: 'this week',
      month: 'this month',
      year: 'this year',
      all: 'all time',
    };
    return { activeDays: ad, totalWorkouts: tw, periodLabel: labels[heatPeriod] };
  }, [sessions, heatPeriod]);

  const tiles: TileConfig[] = useMemo(
    () => [
      // Row 1
      // progress-graph.tsx exists at app/progress-graph.tsx
      { id: 'progress', title: 'progress.', subtitle: 'tap to open', route: '/progress-graph' },
      // (tabs)/(profile)/statistics.tsx — muscle heatmap / body view
      { id: 'muscles', title: 'muscles.', subtitle: 'tap to open', route: '/(tabs)/(profile)/statistics' },
      // Row 2
      // progress-heatmap.tsx exists at app/progress-heatmap.tsx — calendar heatmap
      { id: 'activity', title: 'activity', subtitle: periodLabel, route: '/progress-heatmap' },
      // workout-history.tsx exists at app/workout-history.tsx
      { id: 'history', title: 'history.', subtitle: 'all sessions', route: '/workout-history' },
      // Row 3 — dynamic subtitles with computed values
      { id: 'active-days', title: 'active days', subtitle: `${activeDays} ${periodLabel}`, route: '/progress-heatmap' },
      { id: 'workouts', title: 'workouts', subtitle: `${totalWorkouts} ${periodLabel}`, route: '/workout-history' },
    ],
    [activeDays, totalWorkouts, periodLabel],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: TileConfig; index: number }) => (
      <TileCard item={item} index={index} animTrigger={animTrigger} />
    ),
    [animTrigger],
  );

  const listHeader = (
    <AnimatedFadeInUp delay={0} duration={380} trigger={animTrigger}>
      <View style={{ marginTop: Spacing.sm, marginBottom: 4 }}>
        <LiquidGlassSegmented
          options={[
            { key: 'Nutrition', label: 'Nutrition' },
            { key: 'Fitness', label: 'Fitness' },
          ]}
          value={progressSegment}
          onChange={(k) => setProgressSegment(k as 'Nutrition' | 'Fitness')}
          width={SEGMENT_CONTROL_WIDTH}
        />
      </View>
    </AnimatedFadeInUp>
  );

  return (
    <View style={styles.wrapper}>
      <HomeGradientBackground />
      <FlatList
        data={progressSegment === 'Fitness' ? tiles : []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
    zIndex: 2,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: OUTER_PAD,
    gap: GRID_GAP,
  },
  columnWrapper: {
    gap: GRID_GAP,
  },

  // Outer shadow shell — lives outside overflow:hidden so shadow bleeds.
  // Matches the SwiftUI glass outer glow.
  tileShadow: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: TILE_RADIUS,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 22,
    elevation: 12,
  },

  // The glass surface — clips all visual layers
  tileGlass: {
    flex: 1,
    borderRadius: TILE_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },

  // Layer 2: Slightly lighter fill so blur shows through more
  tileFillOverlay: {
    backgroundColor: 'rgba(47, 48, 49, 0.30)',
    borderRadius: TILE_RADIUS,
  },

  // Border rim — the glass edge lensing
  tileBorderRim: {
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.22)',
  },

  // Content sits on top of all visual layers
  tileContent: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  tileTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 21,
    color: Colors.primaryLight,
  },
  tileSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(198,198,198,0.55)',
    marginTop: 5,
    letterSpacing: -0.1,
  },
});
