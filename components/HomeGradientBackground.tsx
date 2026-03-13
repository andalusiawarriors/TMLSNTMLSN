import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Same gradient background as the home (nutrition) tab: vertical #2F3031 → #1A1A1A.
 * Use in Fitness Hub–derived pages, workout, explore, progress, etc. for consistent look.
 */
export function HomeGradientBackground() {
  return (
    <View style={styles.root} pointerEvents="none">
      <LinearGradient
        colors={['#2F3031', '#1A1A1A']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});
