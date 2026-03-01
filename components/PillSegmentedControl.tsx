// ============================================================
// TMLSN — 2-option pill segmented control (Nutrition / Fitness)
// Matches LiquidGlassPillGroup: BlurView + glass layers + sliding pill
// Tap → select. Long-press + drag → lens scrub (lens follows finger, release commits).
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Match LiquidGlassPillGroup constants
const TRACK_H  = 40;
const TRACK_R  = 20;
const INSET    = 3;
const PILL_R   = 20;

const C = {
  text:      '#C6C6C6',
  dark:      '#2F3031',
  fill:      'rgba(47,48,49,0.26)',
  border:    'rgba(198,198,198,0.16)',
  selPill:   'rgba(198,198,198,0.92)',
  selPillDark: 'rgba(47,48,49,0.18)',
  lensFill:  'rgba(198,198,198,0.12)',
  lensBorder: 'rgba(198,198,198,0.40)',
} as const;

const SEGMENTS = ['Nutrition', 'Fitness'] as const;
export type SegmentValue = (typeof SEGMENTS)[number];

const SPRING_CONFIG = { damping: 18, stiffness: 280, mass: 0.7 };
const LENS_SPRING = { damping: 14, stiffness: 440, mass: 0.22 };
const LONG_MS = 280;

interface PillSegmentedControlProps {
  value: string;
  onValueChange: (value: string) => void;
  segments?: readonly [string, string];
  width?: number;
}

export function PillSegmentedControl({
  value,
  onValueChange,
  segments = SEGMENTS,
  width,
}: PillSegmentedControlProps) {
  const selectedIndex = segments.indexOf(value);
  const numOpts = segments.length;

  const selSlideX = useSharedValue(0);
  const segmentWidth = useSharedValue(0);
  const slotWSV = useSharedValue(0);
  const numOptsSV = useSharedValue(numOpts);

  // Lens scrub
  const isActive = useSharedValue(0);
  const hoverIdx = useSharedValue(selectedIndex);
  const lensX = useSharedValue(0);
  const lensScale = useSharedValue(1);

  const onChangeRef = useRef(onValueChange);
  const segmentsRef = useRef(segments);
  const slotWRef = useRef(0);
  useEffect(() => { onChangeRef.current = onValueChange; }, [onValueChange]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  useEffect(() => { numOptsSV.value = numOpts; }, [numOpts, numOptsSV]);

  useEffect(() => {
    const sw = slotWRef.current;
    if (sw <= 0) return;
    const tx = INSET + selectedIndex * sw;
    selSlideX.value = withSpring(tx, SPRING_CONFIG);
    hoverIdx.value = selectedIndex;
    lensX.value = INSET + selectedIndex * sw + sw / 2;
  }, [selectedIndex]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      const sw = (w - INSET * 2) / numOpts;
      segmentWidth.value = sw;
      slotWSV.value = sw;
      slotWRef.current = sw;
      selSlideX.value = INSET + selectedIndex * sw;
      hoverIdx.value = selectedIndex;
      lensX.value = INSET + selectedIndex * sw + sw / 2;
    },
    [segmentWidth, slotWSV, selectedIndex, numOpts]
  );

  const hLight = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), []);
  const hMedium = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), []);
  const hTick = useCallback(() => Haptics.selectionAsync(), []);

  const commitSelect = useCallback((idx: number) => {
    const segs = segmentsRef.current;
    if (idx >= 0 && idx < segs.length) {
      onChangeRef.current(segs[idx]);
    }
    hMedium();
  }, [hMedium]);

  const tapSelect = useCallback((idx: number) => {
    if (idx === selectedIndex) return;
    hLight();
    const segs = segmentsRef.current;
    if (idx >= 0 && idx < segs.length) onChangeRef.current(segs[idx]);
  }, [selectedIndex, hLight]);

  const slidePan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LONG_MS)
        .onStart((e) => {
          const sw = slotWSV.value;
          const nO = numOptsSV.value;
          if (sw <= 0) return;
          const cx = Math.max(INSET + sw * 0.5, Math.min(INSET + sw * (nO - 0.5), e.x));
          const si = Math.max(0, Math.min(nO - 1, Math.floor((cx - INSET) / sw)));
          hoverIdx.value = si;
          lensX.value = INSET + si * sw + sw / 2;
          isActive.value = withSpring(1, LENS_SPRING);
          lensScale.value = withSpring(1.06, LENS_SPRING);
          runOnJS(hMedium)();
        })
        .onUpdate((e) => {
          const sw = slotWSV.value;
          const nO = numOptsSV.value;
          if (sw <= 0 || isActive.value < 0.1) return;
          const cx = Math.max(INSET + sw * 0.5, Math.min(INSET + sw * (nO - 0.5), e.x));
          lensX.value = cx;
          const ni = Math.max(0, Math.min(nO - 1, Math.floor((cx - INSET) / sw)));
          if (ni !== hoverIdx.value) {
            hoverIdx.value = ni;
            runOnJS(hTick)();
          }
        })
        .onEnd(() => {
          const sw = slotWSV.value;
          lensX.value = withSpring(INSET + hoverIdx.value * sw + sw / 2, SPRING_CONFIG);
          selSlideX.value = withSpring(INSET + hoverIdx.value * sw, SPRING_CONFIG);
          isActive.value = withSpring(0, LENS_SPRING);
          lensScale.value = withSpring(1, LENS_SPRING);
          runOnJS(commitSelect)(hoverIdx.value);
        })
        .onFinalize(() => {
          if (isActive.value > 0.3) {
            isActive.value = withSpring(0, LENS_SPRING);
            lensScale.value = withSpring(1, LENS_SPRING);
          }
        }),
    [slotWSV, numOptsSV, hoverIdx, lensX, isActive, lensScale, selSlideX, hMedium, hTick, commitSelect]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(LONG_MS - 10)
        .onEnd((e, success) => {
          if (!success) return;
          const sw = slotWSV.value;
          const nO = numOptsSV.value;
          if (sw <= 0) return;
          const idx = Math.max(0, Math.min(nO - 1, Math.floor((e.x - INSET) / sw)));
          runOnJS(tapSelect)(idx);
        }),
    [slotWSV, numOptsSV, tapSelect]
  );

  const gesture = Gesture.Race(slidePan, tapGesture);

  const thumbStyle = useAnimatedStyle(() => {
    const w = slotWSV.value;
    if (w <= 0) return {};
    return {
      width: w,
      transform: [{ translateX: selSlideX.value }],
      opacity: interpolate(isActive.value, [0, 0.5, 1], [1, 0.55, 0.08]),
    };
  });

  const lensStyle = useAnimatedStyle(() => {
    const sw = slotWSV.value;
    if (sw <= 0) return { opacity: 0 };
    const lW = sw + 8;
    return {
      width: lW,
      opacity: interpolate(isActive.value, [0, 0.15, 1], [0, 0.4, 1]),
      transform: [
        { translateX: lensX.value - lW / 2 },
        { scale: lensScale.value },
      ],
    };
  });

  return (
    <View style={[styles.outer, width != null && { width }]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>
        <View style={styles.wrapper}>
          {/* Glass track — overflow hidden to clip blur */}
          <View style={styles.track}>
            <BlurView intensity={28} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: TRACK_R }]} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.fill, borderRadius: TRACK_R }]} />
            <LinearGradient
              colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TRACK_R }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.04)', 'transparent']}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.22 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TRACK_R }]}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.16)']}
              start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: TRACK_R }]}
              pointerEvents="none"
            />
            <View
              style={[StyleSheet.absoluteFillObject, { borderRadius: TRACK_R, borderWidth: 1, borderColor: C.border }]}
              pointerEvents="none"
            />
          </View>

          {/* Overlay — overflow visible so thumb/lens can extend when scaled */}
          <View style={styles.overlay} pointerEvents="box-none">
            {/* Sliding selected pill — same as LiquidGlassPillGroup selPill */}
            <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]}>
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_R - 2, backgroundColor: C.selPill }]} />
              <LinearGradient
                colors={['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.12)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.55 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_R - 2 }]}
                pointerEvents="none"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.08)']}
                start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_R - 2 }]}
                pointerEvents="none"
              />
              <View
                style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_R - 2, borderWidth: 1, borderColor: C.selPillDark }]}
                pointerEvents="none"
              />
            </Animated.View>

            {/* Lens bubble — appears during long-press scrub */}
            <Animated.View pointerEvents="none" style={[styles.lens, lensStyle]}>
              <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: TRACK_R }]} />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.lensFill }]} />
              <LinearGradient
                colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.10)', 'transparent']}
                start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />
              <View
                style={[StyleSheet.absoluteFillObject, { borderRadius: TRACK_R, borderWidth: 1, borderColor: C.lensBorder }]}
                pointerEvents="none"
              />
            </Animated.View>

            {/* Segment labels */}
            <View style={styles.overlayContent}>
              <View style={styles.segmentsRow}>
                {segments.map((label, index) => (
                <View key={label} style={styles.segmentTouch} pointerEvents="none">
                  <Text
                    style={[
                      styles.segmentText,
                      selectedIndex === index ? styles.segmentTextSelected : styles.segmentTextUnselected,
                    ]}
                  >
                    {label.toLowerCase()}
                  </Text>
                </View>
              ))}
              </View>
            </View>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

const CLIP_PAD = 6; // room for lens scale so selection isn't cut off

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    width: '100%',
    marginBottom: 12,
  },
  wrapper: {
    position: 'relative',
    paddingVertical: CLIP_PAD,
    overflow: 'visible',
  },
  track: {
    flexDirection: 'row',
    height: TRACK_H,
    borderRadius: TRACK_R,
    paddingHorizontal: INSET,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CLIP_PAD,
    bottom: CLIP_PAD,
    overflow: 'visible',
    flexDirection: 'row',
  },
  overlayContent: {
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: INSET,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: INSET,
    bottom: INSET,
    borderRadius: PILL_R - 2,
    overflow: 'hidden',
  },
  lens: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: TRACK_R,
    overflow: 'hidden',
    zIndex: 5,
  },
  segmentsRow: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  segmentTouch: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  segmentTextSelected: {
    color: C.dark,
    fontWeight: '700',
  },
  segmentTextUnselected: {
    color: C.text,
  },
});
