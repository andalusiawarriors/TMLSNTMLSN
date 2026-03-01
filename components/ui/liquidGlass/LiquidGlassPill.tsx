// ─────────────────────────────────────────────────────────────────────────────
// LiquidGlassPill — standalone tappable pill with animated refraction
//
// Press interaction:
//   • onPressIn  → scale 0.965, refraction highlight shifts, lens blob fades in
//   • onPressOut → spring back, refraction returns to rest
//   • Haptic: selectionAsync on tap
//
// Refraction: diagonal specular band that rotates/shifts on press, simulating
// light bending through glass as the viewing angle changes.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, type ViewStyle, type TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  FadeIn,
  Easing,
} from 'react-native-reanimated';

import { GlassLayers } from './GlassLayers';
import {
  GLASS_RADIUS_PILL,
  PILL_HEIGHT,
  LG,
  SP,
  LONG_PRESS_MS,
} from './tokens';

export type LiquidGlassPillProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPressDrag?: (delta: number) => void;
  scrubEnabled?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
  chevron?: boolean;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  haptics?: boolean;
};

export function LiquidGlassPill({
  label,
  selected = false,
  onPress,
  onLongPressDrag,
  scrubEnabled = true,
  icon,
  disabled = false,
  chevron = false,
  style,
  labelStyle,
  haptics: hapticsEnabled = true,
}: LiquidGlassPillProps) {
  const press = useSharedValue(0);
  const sweepX = useSharedValue(0);
  const isActive = useSharedValue(0);
  const lensScale = useSharedValue(1);
  const accX = useSharedValue(0);
  const STEP_PX = 40;

  const hTick = useCallback(() => {
    if (hapticsEnabled) Haptics.selectionAsync();
  }, [hapticsEnabled]);
  const hMedium = useCallback(() => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [hapticsEnabled]);

  const onPressRef = useRef(onPress);
  const onDragRef = useRef(onLongPressDrag);
  useEffect(() => { onPressRef.current = onPress; }, [onPress]);
  useEffect(() => { onDragRef.current = onLongPressDrag; }, [onLongPressDrag]);

  const fireTap = useCallback(() => { onPressRef.current?.(); }, []);
  const doStep = useCallback((d: number) => { onDragRef.current?.(d); hTick(); }, [hTick]);

  const scrubPan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      isActive.value = withSpring(1, SP.lens);
      lensScale.value = withSpring(1.05, SP.lens);
      accX.value = 0;
      runOnJS(hMedium)();
    })
    .onUpdate((e) => {
      if (isActive.value < 0.1) return;
      const total = e.translationX;
      const steps = Math.floor(total / STEP_PX);
      const prev = Math.floor(accX.value / STEP_PX);
      if (steps !== prev) {
        accX.value = total;
        runOnJS(doStep)(steps - prev);
      }
    })
    .onEnd(() => {
      isActive.value = withSpring(0, SP.lens);
      lensScale.value = withSpring(1, SP.lens);
      runOnJS(hMedium)();
    })
    .onFinalize(() => {
      if (isActive.value > 0.3) {
        isActive.value = withSpring(0, SP.lens);
        lensScale.value = withSpring(1, SP.lens);
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(scrubEnabled ? LONG_PRESS_MS - 10 : 500)
    .onEnd((_e, success) => {
      if (success && !disabled) {
        runOnJS(hTick)();
        runOnJS(fireTap)();
      }
    });

  const tapPressIn = Gesture.Tap()
    .onBegin(() => {
      press.value = withSpring(1, SP.press);
      sweepX.value = 0;
      sweepX.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    })
    .onFinalize(() => {
      press.value = withSpring(0, SP.press);
    });

  const gesture = scrubEnabled
    ? Gesture.Simultaneous(Gesture.Race(scrubPan, tapGesture), tapPressIn)
    : Gesture.Simultaneous(tapGesture, tapPressIn);

  // Scale animation
  const pillAnim = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(isActive.value, [0, 1], [
        interpolate(press.value, [0, 1], [1, 0.965]),
        lensScale.value,
      ]),
    }],
    opacity: disabled ? 0.5 : 1,
  }));

  // Press lens blob
  const lensAnim = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.max(isActive.value, press.value),
      [0, 1],
      [0, 0.22],
    ),
  }));

  // Animated refraction — diagonal highlight shifts + rotates on press
  const refractionAnim = useAnimatedStyle(() => ({
    opacity: interpolate(press.value, [0, 0.3, 1], [0.35, 0.55, 0.7]),
    transform: [
      { translateX: interpolate(press.value, [0, 1], [0, 8]) },
      { rotate: `${interpolate(press.value, [0, 1], [-8, 8])}deg` },
    ],
  }));

  // Specular sweep — L→R band on press
  const sweepAnim = useAnimatedStyle(() => ({
    opacity: press.value * 0.2,
    transform: [{ translateX: interpolate(sweepX.value, [0, 1], [-30, 30]) }],
  }));

  const R = GLASS_RADIUS_PILL;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[st.pill, style, pillAnim]}>
        <GlassLayers radius={R} />

        {/* Frost overlay */}
        <LinearGradient
          colors={LG.specFrost as unknown as string[]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: R }]}
          pointerEvents="none"
        />

        {/* Animated refraction highlight — diagonal band that shifts on press */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { borderRadius: R, overflow: 'hidden' }, refractionAnim]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.05)', 'transparent']}
            locations={[0, 0.3, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Bright top-edge refraction rim */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { borderRadius: R, overflow: 'hidden' }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.12)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.25 }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        {/* Press lens blob */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { borderRadius: R }, lensAnim]}
        >
          <LinearGradient
            colors={LG.pressSpec as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 0.85 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: R }]}
          />
        </Animated.View>

        {/* Specular sweep — horizontal band that slides L→R on press */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { borderRadius: R, overflow: 'hidden' }, sweepAnim]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.18)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Content */}
        {icon}
        <Animated.Text
          key={label}
          entering={FadeIn.duration(180)}
          style={[st.label, selected && st.labelSelected, labelStyle]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
        {chevron && <Text style={st.chevron}>›</Text>}
      </Animated.View>
    </GestureDetector>
  );
}

const st = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: GLASS_RADIUS_PILL,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: LG.text,
    letterSpacing: -0.1,
    zIndex: 1,
  },
  labelSelected: {
    color: LG.textActive,
  },
  chevron: {
    fontSize: 14,
    fontWeight: '400',
    color: LG.textDim,
    marginLeft: 4,
    zIndex: 1,
  },
});
