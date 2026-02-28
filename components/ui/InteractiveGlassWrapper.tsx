// ─────────────────────────────────────────────────────────────────────────────
// InteractiveGlassWrapper
//
// Long-press + drag: spotlight effect (light reflection follows finger).
// Optional onRelease: called on tap or on release after long-press+drag.
//
// Used by: progress-graph stat tiles (no onRelease), profile progress tiles
// (onRelease = navigate).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

const PRESS_SPRING = { damping: 20, stiffness: 300, mass: 0.5 };

export type InteractiveGlassWrapperProps = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  borderRadius?: number;
  /** When true, wrapper sizes to content and spotlight fits the widget exactly. Requires onLayout. */
  fitContent?: boolean;
  /** Called on tap or on release after long-press+drag. When omitted, no navigation/action. */
  onRelease?: () => void;
};

export function InteractiveGlassWrapper({
  children,
  width: widthProp,
  height: heightProp,
  borderRadius = 38,
  fitContent = false,
  onRelease,
}: InteractiveGlassWrapperProps) {
  const isPressed = useSharedValue(0);
  const fingerX = useSharedValue(0.5);
  const fingerY = useSharedValue(0.5);
  const widthSV = useSharedValue(widthProp ?? 1);
  const heightSV = useSharedValue(heightProp ?? 1);

  const width = widthProp ?? widthSV.value;
  const height = heightProp ?? heightSV.value;

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (w > 0 && h > 0) {
        widthSV.value = w;
        heightSV.value = h;
      }
    },
    [widthSV, heightSV],
  );

  const onReleaseRef = useRef(onRelease);
  useEffect(() => { onReleaseRef.current = onRelease; }, [onRelease]);

  useEffect(() => {
    if (!fitContent && widthProp != null && heightProp != null) {
      widthSV.value = widthProp;
      heightSV.value = heightProp;
    }
  }, [fitContent, widthProp, heightProp, widthSV, heightSV]);

  const hPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const fireRelease = useCallback(() => {
    onReleaseRef.current?.();
  }, []);

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(180)
    .onStart((e) => {
      const w = Math.max(1, widthSV.value);
      const h = Math.max(1, heightSV.value);
      isPressed.value = withSpring(1, PRESS_SPRING);
      fingerX.value = e.x / w;
      fingerY.value = e.y / h;
      runOnJS(hPress)();
    })
    .onUpdate((e) => {
      const w = Math.max(1, widthSV.value);
      const h = Math.max(1, heightSV.value);
      fingerX.value = e.x / w;
      fingerY.value = e.y / h;
    })
    .onEnd(() => {
      isPressed.value = withSpring(0, PRESS_SPRING);
      if (onReleaseRef.current) runOnJS(fireRelease)();
    })
    .onFinalize(() => {
      if (isPressed.value > 0.2) {
        isPressed.value = withSpring(0, PRESS_SPRING);
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(200)
    .onEnd((_e, success) => {
      if (success && onReleaseRef.current) {
        runOnJS(hPress)();
        runOnJS(fireRelease)();
      }
    });

  const gesture = onRelease
    ? Gesture.Race(panGesture, tapGesture)
    : panGesture;

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(isPressed.value, [0, 1], [1, 0.965]) },
    ],
  }));

  const tlStyle = useAnimatedStyle(() => {
    const fx = Math.min(1, Math.max(0, fingerX.value));
    const fy = Math.min(1, Math.max(0, fingerY.value));
    const proximity = (1 - fx) * (1 - fy);
    return { opacity: isPressed.value * proximity * 0.38 };
  });

  const trStyle = useAnimatedStyle(() => {
    const fx = Math.min(1, Math.max(0, fingerX.value));
    const fy = Math.min(1, Math.max(0, fingerY.value));
    const proximity = fx * (1 - fy);
    return { opacity: isPressed.value * proximity * 0.38 };
  });

  const blStyle = useAnimatedStyle(() => {
    const fx = Math.min(1, Math.max(0, fingerX.value));
    const fy = Math.min(1, Math.max(0, fingerY.value));
    const proximity = (1 - fx) * fy;
    return { opacity: isPressed.value * proximity * 0.32 };
  });

  const brStyle = useAnimatedStyle(() => {
    const fx = Math.min(1, Math.max(0, fingerX.value));
    const fy = Math.min(1, Math.max(0, fingerY.value));
    const proximity = fx * fy;
    return { opacity: isPressed.value * proximity * 0.32 };
  });

  const rimStyle = useAnimatedStyle(() => {
    const fy = Math.min(1, Math.max(0, fingerY.value));
    return { opacity: isPressed.value * (1 - fy) * 0.30 };
  });

  const absFill = StyleSheet.absoluteFillObject;

  const rootStyle = fitContent
    ? { alignSelf: 'stretch' as const, borderRadius, overflow: 'hidden' as const }
    : { width, height, borderRadius, overflow: 'hidden' as const };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[rootStyle, wrapStyle]} onLayout={fitContent ? onLayout : undefined}>
        {children}
        <Animated.View pointerEvents="none" style={[absFill, { borderRadius }, tlStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.52)', 'rgba(255,255,255,0.06)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 0.9 }}
            style={[absFill, { borderRadius }]}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[absFill, { borderRadius }, trStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.48)', 'rgba(255,255,255,0.05)', 'transparent']}
            start={{ x: 1, y: 0 }} end={{ x: 0.1, y: 0.9 }}
            style={[absFill, { borderRadius }]}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[absFill, { borderRadius }, blStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.36)', 'rgba(255,255,255,0.04)', 'transparent']}
            start={{ x: 0, y: 1 }} end={{ x: 0.9, y: 0.1 }}
            style={[absFill, { borderRadius }]}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[absFill, { borderRadius }, brStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.36)', 'rgba(255,255,255,0.04)', 'transparent']}
            start={{ x: 1, y: 1 }} end={{ x: 0.1, y: 0.1 }}
            style={[absFill, { borderRadius }]}
          />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[absFill, { borderRadius }, rimStyle]}>
          <LinearGradient
            colors={['rgba(255,255,255,0.40)', 'transparent']}
            start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.35 }}
            style={[absFill, { borderRadius }]}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
