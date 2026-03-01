// ─────────────────────────────────────────────────────────────────────────────
// TiltPressable — tilted card interaction (React Bits TiltedCard style)
// Maps finger offset from center to rotateX/rotateY, subtle scale while pressed,
// springs back to neutral on release. Clips to borderRadius.
// ─────────────────────────────────────────────────────────────────────────────

import React, { PropsWithChildren, useRef, useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  borderRadius?: number;
  rotateAmplitude?: number;
  scaleOnPress?: number;
  shadowStyle?: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
  longPressMs?: number;
}>;

export default function TiltPressable({
  children,
  style,
  borderRadius = 16,
  rotateAmplitude = 8,
  scaleOnPress = 1.015,
  shadowStyle,
  onPress,
  onLongPress,
  longPressMs = 420,
}: Props) {
  const rotX = useSharedValue(0);
  const rotY = useSharedValue(0);
  const scale = useSharedValue(1);
  const widthSV = useSharedValue(1);
  const heightSV = useSharedValue(1);

  const onPressRef = useRef(onPress);
  const onLongPressRef = useRef(onLongPress);
  useEffect(() => {
    onPressRef.current = onPress;
    onLongPressRef.current = onLongPress;
  }, [onPress, onLongPress]);

  const firePress = () => onPressRef.current?.();
  const fireLongPress = () => onLongPressRef.current?.();

  const setFromTouch = (x: number, y: number) => {
    'worklet';
    const w = Math.max(1, widthSV.value);
    const h = Math.max(1, heightSV.value);
    const ox = x - w / 2;
    const oy = y - h / 2;
    const nx = Math.max(-1, Math.min(1, ox / (w / 2)));
    const ny = Math.max(-1, Math.min(1, oy / (h / 2)));
    rotX.value = withSpring((-ny) * rotateAmplitude, { damping: 18, stiffness: 320, mass: 0.8 });
    rotY.value = withSpring(nx * rotateAmplitude, { damping: 18, stiffness: 320, mass: 0.8 });
  };

  const reset = () => {
    'worklet';
    const cfg = { damping: 28, stiffness: 180, mass: 1 };
    rotX.value = withSpring(0, cfg);
    rotY.value = withSpring(0, cfg);
    scale.value = withSpring(1, cfg);
  };

  const tap = Gesture.Tap()
    .onBegin(() => {
      scale.value = withSpring(scaleOnPress, { damping: 18, stiffness: 320, mass: 0.8 });
    })
    .onEnd((_e, success) => {
      if (success && onPressRef.current) runOnJS(firePress)();
    })
    .onFinalize(() => {
      reset();
    });

  const hapticLight = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const pan = Gesture.Pan()
    .activateAfterLongPress(longPressMs)
    .onBegin((e) => {
      runOnJS(hapticLight)();
      scale.value = withSpring(scaleOnPress, { damping: 18, stiffness: 320, mass: 0.8 });
      setFromTouch(e.x, e.y);
    })
    .onUpdate((e) => {
      setFromTouch(e.x, e.y);
    })
    .onFinalize(() => {
      reset();
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateX: `${rotX.value}deg` },
      { rotateY: `${rotY.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.clip, style, { borderRadius }]} onLayout={onLayout}>
        <Animated.View style={[animStyle, styles.inner]}>
          {shadowStyle ? (
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { borderRadius, backgroundColor: 'rgba(0,0,0,0.01)' },
                shadowStyle,
              ]}
              pointerEvents="none"
            />
          ) : null}
          <Animated.View style={[styles.contentClip, { borderRadius }]}>
            {children}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'visible',
  },
  inner: {
    flex: 1,
  },
  contentClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
});
