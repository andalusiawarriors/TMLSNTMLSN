// ─────────────────────────────────────────────────────────────────────────────
// GraphPillGroup + GraphScrubPill
//
// Stoic-style pill controls for Graph page: height 44, radius 22, thin look.
// - Tap to select
// - Press scale (0.985) + lens overlay micro-animation
// - Haptics.selectionAsync on selection change
//
// Styles:
// - unselected: rgba(47,48,49,0.22) bg, rgba(198,198,198,0.70) text
// - selected: rgba(198,198,198,0.18) bg, rgba(198,198,198,0.92) text
// - border: 1px rgba(198,198,198,0.18)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

const PILL_H    = 44;
const PILL_R    = 22;
const PAD_H     = 18;
const C_BORDER  = 'rgba(198,198,198,0.18)';
const C_BG_UNS  = 'rgba(47,48,49,0.22)';
const C_BG_SEL  = 'rgba(198,198,198,0.18)';
const C_TEXT_UNS = 'rgba(198,198,198,0.70)';
const C_TEXT_SEL = 'rgba(198,198,198,0.92)';
const C_HIGHLIGHT = 'rgba(255,255,255,0.06)';

export type GraphPillOption = { key: string; label: string };

export type GraphPillGroupProps = {
  options: GraphPillOption[];
  value: string;
  onChange: (key: string) => void;
  style?: object;
};

export function GraphPillGroup({
  options,
  value,
  onChange,
  style,
}: GraphPillGroupProps) {
  const handleSelect = useCallback(
    (key: string) => {
      if (key !== value) {
        Haptics.selectionAsync();
        onChange(key);
      }
    },
    [value, onChange],
  );

  return (
    <View style={[styles.row, style]}>
      {options.map((opt) => (
        <GraphPill
          key={opt.key}
          label={opt.label}
          selected={opt.key === value}
          onPress={() => handleSelect(opt.key)}
        />
      ))}
    </View>
  );
}

// ── Single pill with press animation ─────────────────────────────────────────

function GraphPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const press = useSharedValue(0);
  const lensOpacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(press.value, [0, 1], [1, 0.985]) },
    ],
  }));

  const lensStyle = useAnimatedStyle(() => ({
    opacity: lensOpacity.value,
  }));

  const onPressIn = useCallback(() => {
    press.value = withTiming(1, { duration: 90 });
    lensOpacity.value = withTiming(1, { duration: 90 });
  }, []);

  const onPressOut = useCallback(() => {
    press.value = withSpring(0, { damping: 16, stiffness: 400 });
    lensOpacity.value = withTiming(0, { duration: 120 });
  }, []);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => null}
    >
      <Animated.View
        style={[
          styles.pill,
          selected ? styles.pillSel : styles.pillUns,
          animStyle,
        ]}
      >
        {/* Selected: permanent inner highlight */}
        {selected && (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, styles.lensOverlay]}
          >
            <LinearGradient
              colors={[C_HIGHLIGHT, 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
        )}
        {/* Press: lens overlay (all pills) */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, styles.lensOverlay, lensStyle]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.08)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        <Text
          style={[
            styles.label,
            selected ? styles.labelSel : styles.labelUns,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── GraphScrubPill — same Stoic style, for Month/Year picker ──────────────────

export type GraphScrubPillProps = {
  label: string;
  onTap: () => void;
  style?: object;
};

export function GraphScrubPill({ label, onTap, style }: GraphScrubPillProps) {
  const press = useSharedValue(0);
  const lensOpacity = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(press.value, [0, 1], [1, 0.985]) },
    ],
  }));

  const lensStyle = useAnimatedStyle(() => ({
    opacity: lensOpacity.value,
  }));

  const onPressIn = useCallback(() => {
    press.value = withTiming(1, { duration: 90 });
    lensOpacity.value = withTiming(1, { duration: 90 });
  }, []);

  const onPressOut = useCallback(() => {
    press.value = withSpring(0, { damping: 16, stiffness: 400 });
    lensOpacity.value = withTiming(0, { duration: 120 });
  }, []);

  const handleTap = useCallback(() => {
    Haptics.selectionAsync();
    onTap();
  }, [onTap]);

  return (
    <Pressable
      onPress={handleTap}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[styles.pill, styles.pillUns, animStyle, style]}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, styles.lensOverlay, lensStyle]}
        >
          <LinearGradient
            colors={[C_HIGHLIGHT, 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>
        <Text style={[styles.label, styles.labelUns]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
  },
  pill: {
    height: PILL_H,
    paddingHorizontal: PAD_H,
    borderRadius: PILL_R,
    borderWidth: 1,
    borderColor: C_BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minWidth: 64,
  },
  pillUns: {
    backgroundColor: C_BG_UNS,
  },
  pillSel: {
    backgroundColor: C_BG_SEL,
  },
  lensOverlay: {
    borderRadius: PILL_R,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
  },
  labelUns: {
    color: C_TEXT_UNS,
  },
  labelSel: {
    color: C_TEXT_SEL,
  },
  chevron: {
    fontSize: 15,
    fontWeight: '500',
    color: C_TEXT_UNS,
    marginLeft: 4,
  },
});
