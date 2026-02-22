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

interface AnimatedFadeInUpProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
  /** When this value changes, the animation restarts (e.g. for replay on screen focus) */
  trigger?: number;
}

export function AnimatedFadeInUp({
  children,
  delay = DEFAULT_DELAY,
  duration = DEFAULT_DURATION,
  style,
  trigger = 0,
}: AnimatedFadeInUpProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = 0;
    translateY.value = 20;
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration, easing: Easing.out(Easing.cubic) })
    );
  }, [delay, duration, trigger]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
