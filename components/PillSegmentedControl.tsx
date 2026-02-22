// ============================================================
// TMLSN — 2-option pill segmented control (Nutrition / Fitness)
// Sliding pill overlay, spring animation, cornerRadius 38
// ============================================================

import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Typography } from '../constants/theme';

// Calorie-card-style gradients: border + fill (same gray as calorie card, no color tint)
const THUMB_BORDER_GRADIENT: [string, string] = ['#525354', '#48494A'];
const THUMB_FILL_GRADIENT: [string, string] = ['#363738', '#2E2F30'];
const THUMB_BORDER_INSET = 1;

const PILL_RADIUS = 15;
const PILL_HEIGHT = 30;
const PILL_INSET = 2;
const SEGMENTS = ['Nutrition', 'Fitness'] as const;
export type SegmentValue = (typeof SEGMENTS)[number];

const SPRING_CONFIG = {
  damping: 28,
  stiffness: 460,
  mass: 0.4,
  overshootClamping: false,
};

interface PillSegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Optional segments; defaults to ['Nutrition', 'Fitness'] */
  segments?: readonly [string, string];
  /** Optional width; defaults to full width of parent */
  width?: number;
}

const DRAG_THRESHOLD = 0.25; // fraction of segment width to commit switch
const VELOCITY_THRESHOLD = 200;

export function PillSegmentedControl({
  value,
  onValueChange,
  segments = SEGMENTS,
  width,
}: PillSegmentedControlProps) {
  const selectedIndex = segments.indexOf(value);
  const indexValue = useSharedValue(selectedIndex);
  const segmentWidth = useSharedValue(0);
  const dragOffset = useSharedValue(0);

  useEffect(() => {
    indexValue.value = withSpring(selectedIndex, SPRING_CONFIG);
    dragOffset.value = 0;
  }, [selectedIndex, indexValue, dragOffset]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      segmentWidth.value = (w - PILL_INSET * 2) / 2;
    },
    [segmentWidth]
  );

  const selectIndex = useCallback(
    (index: number) => {
      if (index === selectedIndex) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      indexValue.value = withSpring(index, SPRING_CONFIG);
      onValueChange(segments[index]);
    },
    [selectedIndex, indexValue, onValueChange, segments]
  );

  const commitSelection = useCallback(
    (index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onValueChange(segments[index]);
    },
    [onValueChange, segments]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          const w = segmentWidth.value;
          if (w <= 0) return;
          const idx = indexValue.value;
          const minDrag = -idx * w;
          const maxDrag = (1 - idx) * w;
          const clamped = Math.min(Math.max(e.translationX, minDrag), maxDrag);
          dragOffset.value = clamped;
        })
        .onEnd((e) => {
          const w = segmentWidth.value;
          if (w <= 0) {
            dragOffset.value = withSpring(0, SPRING_CONFIG);
            return;
          }
          const idx = indexValue.value;
          const tx = e.translationX;
          const vx = e.velocityX;
          const threshold = w * DRAG_THRESHOLD;
          let newIndex = idx;
          if (idx === 0 && (tx > threshold || vx > VELOCITY_THRESHOLD)) newIndex = 1;
          else if (idx === 1 && (tx < -threshold || vx < -VELOCITY_THRESHOLD)) newIndex = 0;
          indexValue.value = withSpring(newIndex, SPRING_CONFIG);
          dragOffset.value = withSpring(0, SPRING_CONFIG);
          if (newIndex !== idx) runOnJS(commitSelection)(newIndex);
        }),
    [segmentWidth, indexValue, dragOffset, commitSelection]
  );

  const thumbStyle = useAnimatedStyle(() => {
    const w = segmentWidth.value;
    if (w <= 0) return {};
    return {
      transform: [{ translateX: PILL_INSET + indexValue.value * w + dragOffset.value }],
      width: w,
    };
  });

  return (
    <View
      style={[styles.outer, width != null && { width }]}
      onLayout={onLayout}
    >
      <GestureDetector gesture={panGesture}>
      <View style={styles.outerPill}>
        {/* Sliding selected pill – calorie-card-style gradient (border + fill, gray) */}
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <LinearGradient
            colors={THUMB_BORDER_GRADIENT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_RADIUS - PILL_INSET }]}
          />
          <LinearGradient
            colors={THUMB_FILL_GRADIENT}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[
              StyleSheet.absoluteFillObject,
              {
                top: THUMB_BORDER_INSET,
                left: THUMB_BORDER_INSET,
                right: THUMB_BORDER_INSET,
                bottom: THUMB_BORDER_INSET,
                borderRadius: PILL_RADIUS - PILL_INSET - THUMB_BORDER_INSET,
              },
            ]}
          />
          <View style={styles.thumbGlassOverlay} />
        </Animated.View>
        {/* Segment labels */}
        <View style={styles.segmentsRow}>
          {segments.map((label, index) => (
            <Pressable
              key={label}
              style={styles.segmentTouch}
              onPress={() => selectIndex(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedIndex === index }}
            >
              <Text
                style={[
                  styles.segmentText,
                  selectedIndex === index ? styles.segmentTextSelected : styles.segmentTextUnselected,
                ]}
              >
                {label.toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 0,
    marginBottom: 12,
  },
  outerPill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    backgroundColor: '#2F3031',
    padding: PILL_INSET,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: PILL_RADIUS - PILL_INSET,
    overflow: 'hidden',
  },
  thumbGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: PILL_RADIUS - PILL_INSET,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  segmentsRow: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  segmentTouch: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '500',
  },
  segmentTextSelected: {
    color: Colors.white,
  },
  segmentTextUnselected: {
    color: Colors.white + '80',
  },
});
