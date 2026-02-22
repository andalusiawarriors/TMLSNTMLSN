import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  Pressable,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useSegments } from 'expo-router';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { emitWorkoutExpandOrigin, emitWorkoutOriginRoute, emitClosePopup } from '../utils/fabBridge';
import { useTheme } from '../context/ThemeContext';
import { Typography, Spacing } from '../constants/theme';
import { AnimatedPressable } from './AnimatedPressable';

const TAB_BAR_HEIGHT = 76; // PILL_BOTTOM(19) + PILL_HEIGHT(57)
const SCREEN_WIDTH = Dimensions.get('window').width;
// Hierarchy: tab bar (57) = primary nav. Pill (48) = contextual, same tier as popup pills.
const PILL_HEIGHT = 48;
const PILL_RADIUS = 24; // 48/2 for pill proportion
const PILL_MAX_WIDTH = Math.min(300, SCREEN_WIDTH * 0.82); // compact, centered — not a second nav bar
const BORDER_INSET = 1;
const BUTTON_SIZE = 30;

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
  const pathname = usePathname();
  const segments = useSegments();
  const { colors } = useTheme();
  const {
    activeWorkout,
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
    if (minimized) {
      emitClosePopup();
      // (profile) is a route group — pathname doesn't include it; use segments for progress tab
      const route =
        segments.includes('(profile)') ? '/(tabs)/(profile)'
        : pathname.includes('nutrition') ? '/(tabs)/nutrition'
        : pathname.includes('prompts') ? '/(tabs)/prompts'
        : pathname.includes('workout') ? '/(tabs)/workout'
        : '/(tabs)/nutrition';
      emitWorkoutExpandOrigin(route);
      emitWorkoutOriginRoute(route);
      expandWorkout();
    }
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  // Pill only shows after down arrow is pressed (minimized)
  // Hide when on search/scan screens
  const hideOnFoodFlow =
    pathname.includes('search-food') ||
    pathname.includes('food-action-modal') ||
    pathname.includes('scan-food-camera');
  if (!activeWorkout || !minimized || hideOnFoodFlow) return null;

  return (
    <Animated.View
      style={[
        styles.pillOuter,
        {
          bottom: TAB_BAR_HEIGHT + 8,
        },
        pillStyle,
      ]}
    >
      <View style={[styles.pillBorder, { overflow: 'hidden' }]}>
        <LinearGradient
          colors={colors.tabBarBorder as [string, string]}
          style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_RADIUS }]}
        />
        <LinearGradient
          colors={colors.tabBarFill as [string, string]}
          style={[StyleSheet.absoluteFillObject, styles.pillInner]}
        />
        <View style={[styles.pill, styles.pillContent]}>
          <Pressable
            style={styles.expandArea}
            onPress={handleExpand}
            android_ripple={null}
          >
            <View style={[styles.iconButton, { backgroundColor: colors.primaryDark }]}>
              <Ionicons name="chevron-up" size={18} color={colors.primaryLight} />
            </View>
            <View style={styles.center}>
              <View style={styles.row}>
                <GreenPulsingDot />
                <Text style={[styles.title, { color: colors.primaryLight }]}>
                  {activeWorkout?.name ?? 'Workout'}
                </Text>
                <Text style={[styles.elapsed, { color: colors.primaryLight }]}>
                  {formatElapsed(elapsedSeconds)}
                </Text>
              </View>
            </View>
          </Pressable>
          <AnimatedPressable
            style={[styles.iconButton, { backgroundColor: colors.primaryDark }]}
            onPress={handleConfirmDiscard}
          >
            <Ionicons name="trash-outline" size={16} color={colors.accentRed} />
          </AnimatedPressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pillOuter: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PILL_HEIGHT,
    alignItems: 'center',
    zIndex: 999999,
    elevation: 999999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  pillBorder: {
    width: PILL_MAX_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
  },
  pillInner: {
    position: 'absolute',
    top: BORDER_INSET,
    left: BORDER_INSET,
    right: BORDER_INSET,
    bottom: BORDER_INSET,
    borderRadius: PILL_RADIUS - BORDER_INSET,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  pillContent: {
    position: 'absolute',
    top: BORDER_INSET,
    left: BORDER_INSET,
    right: BORDER_INSET,
    bottom: BORDER_INSET,
    borderRadius: PILL_RADIUS - BORDER_INSET,
  },
  expandArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
    marginHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13,
    textAlign: 'center',
  },
  elapsed: {
    fontSize: 13,
    textAlign: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
