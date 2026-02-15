/**
 * Blur-text animation (adapted from shadcn-style blur text).
 * Words animate in with a staggered "blur to focus" effect (opacity + scale).
 * Uses react-native-reanimated; loops after animationDelay.
 *
 * Usage:
 *   <BlurTextAnimation text="Your headline here" />
 *   <BlurTextAnimation text="Custom" fontSize={18} textColor="#fff" animationDelay={3000} />
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, Typography } from '../constants/theme';

export interface WordData {
  text: string;
  duration: number;
  delay: number;
  blur: number;
  scale?: number;
}

export interface BlurTextAnimationProps {
  text?: string;
  words?: WordData[];
  style?: ViewStyle;
  fontSize?: number;
  fontFamily?: string;
  textColor?: string;
  animationDelay?: number;
}

const DEFAULT_TEXT =
  'Elegant blur animation that brings your words to life with cinematic transitions.';

function buildWordsFromText(text: string): WordData[] {
  const splitWords = text.trim().split(/\s+/).filter(Boolean);
  const totalWords = splitWords.length;
  return splitWords.map((word, index) => {
    const progress = index / totalWords;
    const exponentialDelay = Math.pow(progress, 0.8) * 0.5;
    const baseDelay = index * 0.06;
    const microVariation = (Math.random() - 0.5) * 0.05;
    return {
      text: word,
      duration: 2.2 + Math.cos(index * 0.3) * 0.3,
      delay: baseDelay + exponentialDelay + microVariation,
      blur: 12 + Math.floor(Math.random() * 8),
      scale: 0.9 + Math.sin(index * 0.2) * 0.05,
    };
  });
}

function AnimatedWord({
  word,
  time,
  fontSize,
  fontFamily,
  textColor,
  showSpace,
}: {
  word: WordData;
  time: Animated.SharedValue<number>;
  fontSize: number;
  fontFamily?: string;
  textColor: string;
  showSpace: boolean;
}) {
  const delay = word.delay;
  const duration = word.duration;
  const scaleIn = word.scale ?? 0.92;

  const animatedStyle = useAnimatedStyle(() => {
    const t = time.value;
    const p = interpolate(
      t,
      [delay, delay + duration],
      [0, 1],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(p, [0, 1], [0.25, 1]);
    const scale = interpolate(p, [0, 1], [scaleIn, 1]);
    return { opacity, transform: [{ scale }] };
  });

  return (
    <Animated.View style={[styles.wordWrap, animatedStyle]}>
      <Text
        style={[
          styles.wordText,
          {
            fontSize,
            color: textColor,
            fontFamily: fontFamily || undefined,
          },
        ]}
      >
        {word.text}
      </Text>
      {showSpace && <Text style={[styles.space, { fontSize, color: textColor }]}> </Text>}
    </Animated.View>
  );
}

export default function BlurTextAnimation({
  text = DEFAULT_TEXT,
  words: wordsProp,
  style,
  fontSize = Typography.h2,
  fontFamily,
  textColor = Colors.primaryLight,
  animationDelay = 4000,
}: BlurTextAnimationProps) {
  const words = useMemo(
    () => (wordsProp && wordsProp.length > 0 ? wordsProp : buildWordsFromText(text)),
    [text, wordsProp]
  );

  const time = useSharedValue(0);
  const maxTime = useMemo(() => {
    let max = 0;
    words.forEach((w) => {
      max = Math.max(max, w.delay + w.duration);
    });
    return max + 1;
  }, [words]);

  useEffect(() => {
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      time.value = withDelay(
        animationDelay,
        withTiming(0, { duration: 0 }, (finished) => {
          if (finished === 1) runOnJS(startCycle)();
        })
      );
    };

    const startCycle = () => {
      if (cancelled) return;
      time.value = 0;
      time.value = withTiming(
        maxTime,
        {
          duration: maxTime * 1000,
          easing: Easing.linear,
        },
        (finished) => {
          if (finished === 1) runOnJS(scheduleNext)();
        }
      );
    };

    const t = setTimeout(startCycle, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [words, maxTime, animationDelay, time]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        {words.map((word, index) => (
          <AnimatedWord
            key={`${word.text}-${index}`}
            word={word}
            time={time}
            fontSize={fontSize}
            fontFamily={fontFamily}
            textColor={textColor}
            showSpace={index < words.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  wordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wordText: {
    fontWeight: '500',
  },
  space: {
    fontWeight: '500',
  },
});
