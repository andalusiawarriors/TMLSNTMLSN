// ============================================================
// TMLSN — Heatmap preview widget (swipable: front → back)
// Swipe left for back view; larger body display
// ============================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
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
import { BodyAnatomySvg } from './BodyAnatomySvg';
import { Colors, Spacing, Shadows } from '../constants/theme';

const PROGRESS_CARD_WIDTH = Math.min(380, Dimensions.get('window').width - 40);
const BODY_WIDTH = Math.min(180, PROGRESS_CARD_WIDTH - Spacing.lg * 2);
const BODY_HEIGHT = BODY_WIDTH * 1.5;

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
          <View style={styles.bodyWrap}>
            <BodyAnatomySvg
              variant="front"
              heatmapData={heatmapData}
              selectedDay={todayDayOfWeek}
              maxVolume={maxVolumeForDay}
              pressedMuscleGroup={null}
              width={BODY_WIDTH}
              height={BODY_HEIGHT}
            />
          </View>
        </View>
        {/* Slide 2: Back view */}
        <View style={styles.slide}>
          <View style={styles.bodyWrap}>
            <BodyAnatomySvg
              variant="back"
              heatmapData={heatmapData}
              selectedDay={todayDayOfWeek}
              maxVolume={maxVolumeForDay}
              pressedMuscleGroup={null}
              width={BODY_WIDTH}
              height={BODY_HEIGHT}
            />
          </View>
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
    borderRadius: 38,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    marginBottom: 15,
    overflow: 'hidden',
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
    minHeight: BODY_HEIGHT + Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyWrap: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    overflow: 'hidden',
    ...Shadows.card,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
});
