/**
 * Notebook-style dot grid background for AI chat.
 * Dots are uniform color. Two variants: white and black, for A/B comparison.
 * Toggle (Nutrition/Progress/Fitness) is rendered above this with opaque fill.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

// Design parameters (easily adjustable)
const DOT_SIZE = 2;
const DOT_SPACING = 16;
const DOT_COLOR_WHITE = 'rgba(255,255,255,0.45)';
const DOT_COLOR_BLACK = 'rgba(0,0,0,0.35)';
export type NotebookDotGridVariant = 'white' | 'black';

export type NotebookDotGridProps = {
  variant?: NotebookDotGridVariant;
  dotSize?: number;
  spacing?: number;
};

export function NotebookDotGrid({
  variant = 'white',
  dotSize = DOT_SIZE,
  spacing = DOT_SPACING,
}: NotebookDotGridProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');
  const dotColor = variant === 'white' ? DOT_COLOR_WHITE : DOT_COLOR_BLACK;
  const topExtension = Math.max(insets.top, 120);
  const fullHeight = height + topExtension;

  const dots = useMemo(() => {
    const cols = Math.ceil(width / spacing) + 4;
    const rows = Math.ceil(fullHeight / spacing) + 4;
    const list: { cx: number; cy: number }[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        list.push({
          cx: col * spacing + spacing / 2,
          cy: row * spacing + spacing / 2,
        });
      }
    }
    return list;
  }, [width, fullHeight, spacing]);

  return (
    <View style={[styles.root, { top: -topExtension - 3, height: fullHeight }]} pointerEvents="none">
      <Svg width={width} height={fullHeight} style={styles.svg}>
        {dots.map((d, i) => (
          <Circle
            key={i}
            cx={d.cx}
            cy={d.cy}
            r={dotSize / 2}
            fill={dotColor}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: 'visible',
  },
  svg: {
    backgroundColor: 'transparent',
  },
});
