import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

/**
 * Theme-aware gradient background. Dark: #2f3031 → #1a1a1a. Light: #C6C6C6 → #B0B0B0.
 */
export function HomeGradientBackground() {
  const { colors } = useTheme();
  const [start, end] = colors.backgroundGradient;
  return (
    <View style={styles.root} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="homeBgGrad" cx="0%" cy="0%" r="150%" fx="0%" fy="0%">
            <Stop offset="0" stopColor={start} />
            <Stop offset="1" stopColor={end} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#homeBgGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});
