// ============================================================
// ShinyText — animated gradient sweep across text (React Native)
// Matches Customize: speed 5s, delay 0s, spread 120°, color #b5b5b5, shine #ffffff,
// direction left, yoyo off. Silver-gradient style: multi-tonal metallic sweep.
// ============================================================

import React, { useEffect } from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const GRADIENT_WIDTH = 800;
const CYCLE_WIDTH = GRADIENT_WIDTH / 2;

export interface ShinyTextProps {
  text: string;
  speed?: number;
  delay?: number;
  spread?: number; // degrees, e.g. 120 = wider highlight band
  yoyo?: boolean;
  color?: string;
  shineColor?: string;
  direction?: 'left' | 'right';
  style?: TextStyle;
  containerStyle?: ViewStyle;
}

export function ShinyText({
  text,
  speed = 5,
  delay = 0,
  spread = 120,
  yoyo = false,
  color = '#b5b5b5',
  shineColor = '#ffffff',
  direction = 'left',
  style,
  containerStyle,
}: ShinyTextProps) {
  const translateX = useSharedValue(0);

  useEffect(() => {
    // Both directions use negative translateX so gradient stays within mask (avoids cutoff).
    // left = shine left→right: 0 → -CYCLE_WIDTH
    // right = shine right→left: -CYCLE_WIDTH → 0
    const [start, end] =
      direction === 'left' ? [0, -CYCLE_WIDTH] : [-CYCLE_WIDTH, 0];
    translateX.value = start;
    translateX.value = withDelay(
      delay * 1000,
      withRepeat(
        withTiming(end, {
          duration: speed * 1000,
          easing: Easing.linear,
        }),
        Infinity,
        yoyo
      )
    );
  }, [speed, delay, yoyo, direction]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Silver-gradient style: multi-tonal metallic sweep (like SILVER in TodaysSessionCarousel)
  // 2 identical cycles (0–0.5, 0.5–1) for seamless loop; spread 120° = wider highlight band
  const mid1 = '#c8c8c8';
  const mid2 = '#d8d8d8';
  const cycleColors = [color, color, mid1, mid2, shineColor, mid2, color];
  const cycleLocs = [0, 0.15, 0.25, 0.35, 0.4, 0.45, 0.5];
  const gradientColors = [
    ...cycleColors,
    color,
    mid1,
    mid2,
    shineColor,
    mid2,
    color,
  ];
  const gradientLocations = [
    ...cycleLocs,
    ...cycleLocs.slice(1).map((l) => 0.5 + l), // avoid duplicate 0.5
  ];

  return (
    <MaskedView
      style={[{ alignSelf: 'flex-start', overflow: 'hidden' }, containerStyle]}
      maskElement={
        <Text style={[styles.maskText, style, { backgroundColor: 'transparent' }]}>
          {text}
        </Text>
      }
    >
      <Animated.View style={[styles.gradientWrap, animatedStyle]}>
        <LinearGradient
          colors={gradientColors as [string, string, ...string[]]}
          locations={gradientLocations as [number, number, ...number[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Text style={[styles.maskText, style, { opacity: 0 }]}>{text}</Text>
        </LinearGradient>
      </Animated.View>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  maskText: {
    backgroundColor: 'transparent',
  },
  gradientWrap: {
    width: GRADIENT_WIDTH,
    minHeight: 42,
  },
  gradient: {
    width: GRADIENT_WIDTH,
    minHeight: 42,
  },
});
