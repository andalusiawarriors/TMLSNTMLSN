// ─────────────────────────────────────────────────────────────────────────────
// SpotlightPressable — radial spotlight overlay that follows finger on press/drag
// Fades in on press-in, follows finger while pressed/dragged, fades out on release.
// Supports tap and long-press actions. Clips to borderRadius.
// ─────────────────────────────────────────────────────────────────────────────

import React, { PropsWithChildren, useRef } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedRadialGradient = Animated.createAnimatedComponent(RadialGradient);

let spotIdCounter = 0;

type Props = PropsWithChildren<{
  style?: ViewStyle;
  borderRadius?: number;
  spotlightColor?: string;
  fadeInMs?: number;
  fadeOutMs?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  longPressMs?: number;
}>;

export default function SpotlightPressable({
  children,
  style,
  borderRadius = 16,
  spotlightColor = 'rgba(255,255,255,0.02)',
  fadeInMs = 100,
  fadeOutMs = 320,
  onPress,
  onLongPress,
  longPressMs = 420,
}: Props) {
  const gradientId = useRef(`spot-${++spotIdCounter}`).current;
  const opacity = useSharedValue(0);
  const cx = useSharedValue(50);
  const cy = useSharedValue(50);
  const widthSV = useSharedValue(1);
  const heightSV = useSharedValue(1);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const updateCenter = (x: number, y: number) => {
    'worklet';
    const w = Math.max(1, widthSV.value);
    const h = Math.max(1, heightSV.value);
    const px = Math.max(0, Math.min(1, x / w));
    const py = Math.max(0, Math.min(1, y / h));
    cx.value = px * 100;
    cy.value = py * 100;
  };

  const onPressRef = React.useRef(onPress);
  const onLongPressRef = React.useRef(onLongPress);
  React.useEffect(() => {
    onPressRef.current = onPress;
    onLongPressRef.current = onLongPress;
  }, [onPress, onLongPress]);

  const firePress = () => onPressRef.current?.();
  const fireLongPress = () => onLongPressRef.current?.();

  const tap = Gesture.Tap()
    .onBegin((e) => {
      opacity.value = withTiming(0.45, { duration: fadeInMs });
      updateCenter(e.x, e.y);
    })
    .onEnd((_e, success) => {
      if (success && onPressRef.current) runOnJS(firePress)();
    });

  const pan = Gesture.Pan()
    .onBegin((e) => {
      opacity.value = withTiming(0.45, { duration: fadeInMs });
      updateCenter(e.x, e.y);
    })
    .onUpdate((e) => {
      updateCenter(e.x, e.y);
    })
    .onFinalize(() => {
      opacity.value = withTiming(0, { duration: fadeOutMs });
    });

  const longPress = Gesture.LongPress()
    .minDuration(longPressMs)
    .onStart(() => {
      if (onLongPressRef.current) runOnJS(fireLongPress)();
    });

  const gesture = Gesture.Simultaneous(pan, tap, longPress);

  const onLayout = (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) {
      widthSV.value = w;
      heightSV.value = h;
    }
  };

  const gradientAnimatedProps = useAnimatedProps(() => ({
    cx: `${cx.value}%`,
    cy: `${cy.value}%`,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.wrap, style, { borderRadius }]}
        onLayout={onLayout}
      >
        {children}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, overlayStyle, { borderRadius, overflow: 'hidden' }]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <AnimatedRadialGradient
                id={gradientId}
                r="90%"
                animatedProps={gradientAnimatedProps}
              >
                <Stop offset="0%" stopColor={spotlightColor} stopOpacity="0.5" />
                <Stop offset="100%" stopColor={spotlightColor} stopOpacity="0" />
              </AnimatedRadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
          </Svg>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
});
