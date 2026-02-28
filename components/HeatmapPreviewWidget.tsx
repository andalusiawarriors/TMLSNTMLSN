// ============================================================
// TMLSN — Heatmap preview widget (swipable: front → back)
// + Side-by-side variant (front & back, last 7 days aggregate) for home
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { HeatmapData } from '../utils/weeklyMuscleTracker';
import { DetailedBodyHeatmap } from './DetailedBodyHeatmap';
import { Colors, Spacing, Shadows, Typography, BorderRadius } from '../constants/theme';
import { getUserSettings } from '../utils/storage';

const PROGRESS_CARD_WIDTH = Math.min(380, Dimensions.get('window').width - 40);
const BODY_WIDTH = Math.min(180, PROGRESS_CARD_WIDTH - Spacing.lg * 2);
const BODY_HEIGHT = BODY_WIDTH * 1.5;

/** Aggregate heatmap byDay to "last 7 days" (sum per group) for display */
function aggregateHeatmapLast7Days(heatmapData: HeatmapData[]): HeatmapData[] {
  return heatmapData.map((h) => {
    let sum = 0;
    for (let d = 0; d < 7; d++) sum += h.byDay[d] ?? 0;
    const byDay: Record<number, number> = { 0: sum, 1: sum, 2: sum, 3: sum, 4: sum, 5: sum, 6: sum };
    return { ...h, byDay };
  });
}

function AnimatedDot({ active }: { active: boolean }) {
  const scale = useSharedValue(active ? 1.2 : 1);

  useEffect(() => {
    scale.value = withSpring(active ? 1.2 : 1, { damping: 12, stiffness: 200 });
  }, [active]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        active && styles.dotActive,
        dotStyle,
      ]}
    />
  );
}

interface HeatmapPreviewWidgetProps {
  heatmapData: HeatmapData[];
}

export function HeatmapPreviewWidget({ heatmapData }: HeatmapPreviewWidgetProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [gender, setGender] = useState<'male' | 'female'>('male');

  useEffect(() => {
    getUserSettings().then((s) => {
      if (s.bodyMapGender) setGender(s.bodyMapGender);
    });
  }, []);

  const todayDayOfWeek = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    return day === 0 ? 6 : day - 1;
  }, []);

  const maxVolumeForDay = useMemo(() => {
    return Math.max(
      1,
      ...heatmapData.map((h) => h.byDay[todayDayOfWeek] ?? 0)
    );
  }, [heatmapData, todayDayOfWeek]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = PROGRESS_CARD_WIDTH;
    const page = Math.round(e.nativeEvent.contentOffset.x / w);
    setPageIndex(Math.min(page, 1));
  };

  return (
    <View style={styles.card}>
      <ScrollView
        horizontal
        pagingEnabled
        snapToInterval={PROGRESS_CARD_WIDTH}
        snapToAlignment="center"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Slide 1: Front view */}
        <View style={styles.slide}>
          <DetailedBodyHeatmap
            heatmapData={heatmapData}
            selectedDay={todayDayOfWeek}
            maxVolume={maxVolumeForDay}
            variant="front"
            gender={gender}
            width={BODY_WIDTH}
            showCard={false}
          />
        </View>
        {/* Slide 2: Back view */}
        <View style={styles.slide}>
          <DetailedBodyHeatmap
            heatmapData={heatmapData}
            selectedDay={todayDayOfWeek}
            maxVolume={maxVolumeForDay}
            variant="back"
            gender={gender}
            width={BODY_WIDTH}
            showCard={false}
          />
        </View>
      </ScrollView>
      {/* Page dots */}
      <View style={styles.dots}>
        <AnimatedDot active={pageIndex === 0} />
        <AnimatedDot active={pageIndex === 1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PROGRESS_CARD_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    marginBottom: 15,
    overflow: 'hidden',
    borderRadius: 38,
    backgroundColor: Colors.primaryDark,
    ...Shadows.card,
  },
  scrollView: {
    width: PROGRESS_CARD_WIDTH,
  },
  scrollContent: {
    alignItems: 'center',
  },
  slide: {
    width: PROGRESS_CARD_WIDTH,
    minHeight: BODY_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight + '40',
  },
  dotActive: {
    backgroundColor: Colors.primaryLight,
  },

  // ─── Side-by-side (front + back) for home carousel – last 7 days ─────────
  sideBySideCard: {
    alignSelf: 'center' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '20',
    ...Shadows.card,
  },
  sideBySideTitle: {
    fontSize: Typography.label,
    fontWeight: '500',
    color: Colors.primaryLight + 'CC',
    textTransform: 'lowercase' as const,
    letterSpacing: -0.11,
    marginBottom: Spacing.sm,
  },
  sideBySideRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sideBySideCell: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sideBySideLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.primaryLight + '99',
    textTransform: 'lowercase' as const,
    letterSpacing: -0.11,
    marginTop: 2,
  },
});

// ─── Side-by-side (front + back) for home carousel – last 7 days ─────────────

interface HeatmapPreviewWidgetSideBySideProps {
  heatmapData: HeatmapData[];
  /** Card width to fit carousel (e.g. CAROUSEL_WIDTH). Default: full width minus padding. */
  cardWidth?: number;
  /** If true, render without card background/border (isolated like calorie/macro displays). */
  bare?: boolean;
}

export function HeatmapPreviewWidgetSideBySide({
  heatmapData,
  cardWidth = Dimensions.get('window').width - 38,
  bare = false,
}: HeatmapPreviewWidgetSideBySideProps) {
  const [gender, setGender] = useState<'male' | 'female'>('male');

  useEffect(() => {
    getUserSettings().then((s) => {
      if (s.bodyMapGender) setGender(s.bodyMapGender);
    });
  }, []);

  const weekAggregate = useMemo(
    () => aggregateHeatmapLast7Days(heatmapData),
    [heatmapData]
  );

  const maxVolume = useMemo(() => {
    let max = 1;
    for (const h of weekAggregate) {
      const sum = (h.byDay[0] ?? 0) + (h.byDay[1] ?? 0) + (h.byDay[2] ?? 0) +
        (h.byDay[3] ?? 0) + (h.byDay[4] ?? 0) + (h.byDay[5] ?? 0) + (h.byDay[6] ?? 0);
      if (sum > max) max = sum;
    }
    return max;
  }, [weekAggregate]);

  // Match home carousel page 0: calories card (136) + gap (8) + macro row (140) = 284
  const TARGET_WIDGET_HEIGHT = 136 + Spacing.sm + 140;
  const gap = Spacing.sm;
  const padding = Spacing.md;
  const paddingVertical = Spacing.sm;
  const titleWithMargin = 13 + Spacing.sm;
  const labelWithMargin = 11 + 4;
  const bodyHeight = Math.max(
    60,
    TARGET_WIDGET_HEIGHT - paddingVertical * 2 - titleWithMargin - labelWithMargin
  );
  const bodyWidth = Math.min(
    Math.floor((cardWidth - padding * 2 - gap) / 2),
    Math.floor(bodyHeight / 1.5)
  );

  const containerStyle = bare
    ? { width: cardWidth, height: TARGET_WIDGET_HEIGHT, alignSelf: 'center' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md }
    : [styles.sideBySideCard, { width: cardWidth, height: TARGET_WIDGET_HEIGHT }];

  return (
    <View style={containerStyle}>
      <Text style={styles.sideBySideTitle}>muscles hit · last 7 days</Text>
      <View style={styles.sideBySideRow}>
        <View style={styles.sideBySideCell}>
          <DetailedBodyHeatmap
            heatmapData={weekAggregate}
            selectedDay={0}
            maxVolume={maxVolume}
            variant="front"
            gender={gender}
            width={bodyWidth}
            showCard={false}
          />
          <Text style={styles.sideBySideLabel}>front</Text>
        </View>
        <View style={[styles.sideBySideCell, { marginLeft: gap }]}>
          <DetailedBodyHeatmap
            heatmapData={weekAggregate}
            selectedDay={0}
            maxVolume={maxVolume}
            variant="back"
            gender={gender}
            width={bodyWidth}
            showCard={false}
          />
          <Text style={styles.sideBySideLabel}>back</Text>
        </View>
      </View>
    </View>
  );
}
