import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing } from '../constants/theme';
import { AnimatedPressable } from './AnimatedPressable';

const TAB_BAR_HEIGHT = 76; // PILL_BOTTOM(19) + PILL_HEIGHT(57)
const PILL_MARGIN = 16;
const SCREEN_WIDTH = Dimensions.get('window').width;
const PILL_WIDTH = SCREEN_WIDTH - PILL_MARGIN * 2;
const PILL_HEIGHT = 64;
const BUTTON_SIZE = 40;

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

function GreenPulsingDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.dot, dotStyle]}>
      <View style={[styles.dotInner, { backgroundColor: '#34C759' }]} />
    </Animated.View>
  );
}

export function ActiveWorkoutPill() {
  const { colors } = useTheme();
  const {
    activeWorkout,
    currentExerciseName,
    workoutStartTime,
    minimized,
    expandWorkout,
    discardWorkout,
  } = useActiveWorkout();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const translateY = useSharedValue(80);
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!workoutStartTime) return;
    const tick = () => {
      setElapsedSeconds(Math.floor((Date.now() - workoutStartTime) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [workoutStartTime]);

  useEffect(() => {
    if (activeWorkout && minimized) {
      translateY.value = 80;
      scale.value = 0.92;
      opacity.value = 0;
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 280,
        mass: 0.8,
      });
      scale.value = withSpring(1, {
        damping: 18,
        stiffness: 200,
      });
      opacity.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [activeWorkout, minimized]);

  const handleConfirmDiscard = () => {
    Alert.alert(
      'Discard workout?',
      'Your progress will be lost. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () =>
            discardWorkout(() => {
              // Callback after discard - could navigate if needed
            }),
        },
      ]
    );
  };

  const handleExpand = () => {
    if (minimized) expandWorkout();
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  // Pill only shows after down arrow is pressed (minimized)
  if (!activeWorkout || !minimized) return null;

  return (
    <Animated.View
      style={[
        styles.pill,
        {
          backgroundColor: colors.primaryDarkLighter,
          bottom: TAB_BAR_HEIGHT + 8,
        },
        pillStyle,
      ]}
    >
      <AnimatedPressable
        style={[styles.iconButton, { backgroundColor: colors.primaryDark }]}
        onPress={handleExpand}
      >
        <Ionicons name="chevron-up" size={22} color={colors.primaryLight} />
      </AnimatedPressable>

      <View style={styles.center}>
        <View style={styles.row}>
          <GreenPulsingDot />
          <Text style={[styles.title, { color: colors.primaryLight }]}>Workout</Text>
          <Text style={[styles.elapsed, { color: colors.primaryLight }]}>
            {formatElapsed(elapsedSeconds)}
          </Text>
        </View>
        <Text
          style={[styles.subtitle, { color: colors.primaryLight + '99' }]}
          numberOfLines={1}
        >
          {currentExerciseName}
        </Text>
      </View>

      <AnimatedPressable
        style={[styles.iconButton, { backgroundColor: colors.primaryDark }]}
        onPress={handleConfirmDiscard}
      >
        <Ionicons name="trash-outline" size={20} color={colors.accentRed} />
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    left: PILL_MARGIN,
    right: PILL_MARGIN,
    height: PILL_HEIGHT,
    borderRadius: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    zIndex: 99998,
    elevation: 99998,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  iconButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    marginHorizontal: Spacing.md,
    justifyContent: 'center',
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: Typography.body,
  },
  elapsed: {
    fontSize: Typography.label,
    marginLeft: 'auto',
  },
  subtitle: {
    fontSize: Typography.label,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
