import React, { useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Glass } from '../../constants/theme';

const SPRING = { damping: 22, stiffness: 360, mass: 0.35 };
const INSET = 3;
const HEIGHT = 38;

interface GlassSegmentedControlProps {
  segments: readonly string[];
  value: string;
  onValueChange: (value: string) => void;
  width?: number;
}

export function GlassSegmentedControl({
  segments,
  value,
  onValueChange,
  width,
}: GlassSegmentedControlProps) {
  const selectedIndex = segments.indexOf(value);
  const count = segments.length;
  const indexVal = useSharedValue(selectedIndex);
  const segW = useSharedValue(0);

  useEffect(() => {
    indexVal.value = withSpring(selectedIndex, SPRING);
  }, [selectedIndex, indexVal]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      segW.value = (e.nativeEvent.layout.width - INSET * 2) / count;
    },
    [segW, count],
  );

  const select = useCallback(
    (idx: number) => {
      if (idx === selectedIndex) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      indexVal.value = withSpring(idx, SPRING);
      onValueChange(segments[idx]);
    },
    [selectedIndex, indexVal, onValueChange, segments],
  );

  const thumbStyle = useAnimatedStyle(() => {
    const w = segW.value;
    if (w <= 0) return {};
    return {
      width: w,
      transform: [{ translateX: INSET + indexVal.value * w }],
    };
  });

  return (
    <View
      style={[styles.track, width != null ? { width } : undefined]}
      onLayout={onLayout}
    >
      {/* Track blur base */}
      <BlurView
        intensity={Glass.blurIntensity}
        tint="dark"
        style={[StyleSheet.absoluteFillObject, { borderRadius: HEIGHT / 2 }]}
      />
      {/* Track dark fill */}
      <View style={[StyleSheet.absoluteFillObject, styles.trackFill, { borderRadius: HEIGHT / 2 }]} />

      {/* Sliding "glass prominent" thumb */}
      <Animated.View style={[styles.thumb, thumbStyle]}>
        {/* Thumb specular highlight */}
        <LinearGradient
          colors={[Glass.specularStrong, Glass.innerGlow, 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.8 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: (HEIGHT - INSET * 2) / 2 }]}
          pointerEvents="none"
        />
      </Animated.View>

      <View style={styles.labels}>
        {segments.map((seg, i) => (
          <Pressable
            key={seg}
            style={styles.labelTouch}
            onPress={() => select(i)}
          >
            <Text
              style={[
                styles.labelText,
                i === selectedIndex && styles.labelTextActive,
              ]}
            >
              {seg}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    backgroundColor: 'rgba(47, 48, 49, 0.75)',
    borderWidth: Glass.borderWidth,
    borderColor: 'rgba(198, 198, 198, 0.18)',
    padding: INSET,
    justifyContent: 'center',
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  trackFill: {
    backgroundColor: 'rgba(47, 48, 49, 0.40)',
  },
  thumb: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    borderRadius: (HEIGHT - INSET * 2) / 2,
    backgroundColor: Glass.fillSelected,
    borderWidth: Glass.borderWidth,
    borderColor: Glass.borderSelected,
    overflow: 'hidden',
  },
  labels: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  labelTouch: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelText: {
    fontSize: 13,
    fontWeight: '500',
    color: Glass.textSecondary,
    letterSpacing: -0.1,
  },
  labelTextActive: {
    fontWeight: '600',
    color: Glass.textPrimary,
  },
});
