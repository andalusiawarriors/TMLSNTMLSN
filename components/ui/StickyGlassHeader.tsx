// ─────────────────────────────────────────────────────────────────────────────
// StickyGlassHeader
//
// Premium iOS-style sticky header with a gradient scrim that ramps on scroll.
// At scrollY=0 the scrim is invisible; as scroll increases a top-heavy gradient
// fades in — no hard bottom edge, just a smooth fade to transparent.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FADE_EXTRA = 32;

export type StickyGlassHeaderProps = {
  title: string;
  subtitle?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
  scrollY: SharedValue<number>;
  onLayout?: (height: number) => void;
};

export function StickyGlassHeader({
  title,
  subtitle,
  leftSlot,
  rightSlot,
  children,
  scrollY,
  onLayout,
}: StickyGlassHeaderProps) {
  const insets = useSafeAreaInsets();

  const handleLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) onLayout?.(h);
    },
    [onLayout],
  );

  const scrimStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 20, 80],
      [0.35, 0.7, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + 18 }]}
      onLayout={handleLayout}
      pointerEvents="box-none"
    >
      {/* Gradient scrim — extends past content, fades to transparent */}
      <Animated.View
        pointerEvents="none"
        style={[styles.scrimWrap, scrimStyle]}
      >
        <LinearGradient
          colors={[
            'rgba(47,48,49,1.0)',
            'rgba(47,48,49,0.96)',
            'rgba(47,48,49,0.82)',
            'rgba(47,48,49,0.40)',
            'rgba(47,48,49,0.00)',
          ]}
          locations={[0, 0.3, 0.55, 0.8, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      </Animated.View>

      {/* Content — title row + pills */}
      <View style={[styles.titleRow, { zIndex: 1 }]}>
        {leftSlot ?? <View style={styles.hSpacer} />}
        <View style={styles.titleBlock}>
          {title !== '' && <Text style={styles.title}>{title}</Text>}
          {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {rightSlot ?? <View style={styles.hSpacer} />}
      </View>

      <View style={[styles.pillsRow, { zIndex: 1 }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  scrimWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: -FADE_EXTRA,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: 'rgba(198,198,198,0.92)',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(198,198,198,0.55)',
    letterSpacing: 0,
    marginTop: 2,
  },
  hSpacer: {
    width: 36,
    height: 36,
  },
  pillsRow: {
    gap: 0,
    alignItems: 'flex-end',
  },
});
