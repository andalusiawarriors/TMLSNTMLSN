// ============================================================
// TMLSN — Liquid glass streak widget (header pill)
// Shows workout streak days, navigates to streak subpage
// ============================================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, Image, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useButtonSound } from '../hooks/useButtonSound';
import { getStreakData } from '../utils/streak';
import { Font, Typography } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const ROTATION_PRESSED = -45; // degrees on press
const ROTATION_RELEASED = 0; // anticlockwise back to original rest position
const PRESS_DURATION_MS = 450;
const RELEASE_DURATION_MS = 280; // snappy return, then boom onto page

export function StreakWidget() {
  const router = useRouter();
  const { playIn, playOut } = useButtonSound();
  const { colors, theme } = useTheme();
  const [days, setDays] = useState(0);
  const rotation = useSharedValue(0);
  const loadStreak = () => {
    getStreakData().then((d) => setDays(d.days));
  };

  useFocusEffect(
    React.useCallback(() => {
      loadStreak();
    }, [])
  );

  useEffect(() => {
    loadStreak();
  }, []);

  const ensoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handlePressIn = () => {
    cancelAnimation(rotation);
    rotation.value = withTiming(ROTATION_PRESSED, {
      duration: PRESS_DURATION_MS,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    playIn();
  };

  const handlePressOut = () => {
    cancelAnimation(rotation);
    rotation.value = withTiming(ROTATION_RELEASED, {
      duration: RELEASE_DURATION_MS,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
    playOut();
  };

  const handlePress = () => {
    router.push('/workout/streak');
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={styles.pressable}
    >
      <View style={[styles.glassWrap, { borderColor: colors.primaryLight + '25' }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={40}
            tint={theme === 'light' ? 'light' : 'dark'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: colors.primaryDark + 'E6', borderRadius: 20 },
          ]}
        />
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
          <Animated.View style={[styles.ensoWrap, ensoAnimatedStyle]}>
            <Image
              source={require('../assets/enso.png')}
              style={[styles.ensoIcon, { backgroundColor: 'transparent', tintColor: colors.cardIconTint }]}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={[styles.number, { color: colors.primaryLight }]}>{days}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  glassWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 20,
    overflow: 'hidden',
    minWidth: 70,
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ensoWrap: {
    width: 24,
    height: 24,
  },
  ensoIcon: {
    width: 24,
    height: 24,
    backgroundColor: 'transparent',
  },
  number: {
    fontFamily: Font.monoMedium,
    fontWeight: '500',
    fontSize: Typography.promptText,
  },
});
