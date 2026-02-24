import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Same gradient background as the home (nutrition) tab: radial #2f3031 → #1a1a1a.
 * Use in workout, explore, progress, etc. for consistent look.
 */
export function HomeGradientBackground() {
  return (
    <View style={styles.root} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="homeBgGrad" cx="0%" cy="0%" r="150%" fx="0%" fy="0%">
            <Stop offset="0" stopColor="#2f3031" />
            <Stop offset="1" stopColor="#1a1a1a" />
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
