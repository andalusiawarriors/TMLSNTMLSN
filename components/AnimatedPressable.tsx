// ============================================================
// TMLSN — Pressable with scale animation on press
// ============================================================

import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';

const PRESS_SCALE = 0.97;
const PRESS_DURATION = 80;
const RELEASE_SPRING = { damping: 15, stiffness: 400 };

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AnimatedPressable({ children, style, onPressIn, onPressOut, ...rest }: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = (e: any) => {
    scale.value = withTiming(PRESS_SCALE, {
      duration: PRESS_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    onPressIn?.(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, RELEASE_SPRING);
    onPressOut?.(e);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...rest}
    >
      <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}
