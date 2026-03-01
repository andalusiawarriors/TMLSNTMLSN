// ============================================================
// TMLSN — Reusable entrance animation (fade in + slide up)
// ============================================================

import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const DEFAULT_DURATION = 400;
const DEFAULT_DELAY = 0;

const DEFAULT_TRANSLATE_Y = 20;

export type AnimatedFadeInUpVariant = 'fadeUp' | 'bubble';

interface AnimatedFadeInUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
  /** Vertical distance in px (default 20). Ignored when variant='bubble'. */
  distance?: number;
  /** When this value changes, the animation restarts (e.g. for replay on screen focus) */
  trigger?: number;
  /** Skip the animation and jump to completed state */
  instant?: boolean;
  /** 'fadeUp' = opacity + translateY (default). 'bubble' = opacity + scale, no vertical movement. */
  variant?: AnimatedFadeInUpVariant;
}

export function AnimatedFadeInUp({
  children,
  delay = DEFAULT_DELAY,
  duration = DEFAULT_DURATION,
  style,
  distance = DEFAULT_TRANSLATE_Y,
  trigger = 0,
  instant = false,
  variant = 'fadeUp',
}: AnimatedFadeInUpProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(distance);
  const scale = useSharedValue(variant === 'bubble' ? 0.92 : 1);

  useEffect(() => {
    if (instant) {
      opacity.value = 1;
      translateY.value = 0;
      scale.value = 1;
      return;
    }
    opacity.value = 0;
    translateY.value = variant === 'bubble' ? 0 : distance;
    scale.value = variant === 'bubble' ? 0.92 : 1;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    );
    if (variant === 'bubble') {
      scale.value = withDelay(
        delay,
        withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
      );
    } else {
      translateY.value = withDelay(
        delay,
        withTiming(0, { duration, easing: Easing.out(Easing.cubic) })
      );
    }
  }, [delay, duration, distance, trigger, instant, variant]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform:
      variant === 'bubble'
        ? [{ scale: scale.value }]
        : [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
