// ─────────────────────────────────────────────────────────────────────────────
// LiquidGlassSegmented — iOS 26 Liquid Glass segmented control
//
// Behaviour:
//   • Tap option → select with spring slide + scale pulse
//   • Long-press + drag → lens scrub: lens follows finger, haptic per slot
//
// Visual: 6-layer glass track (clipped), overlay layer (not clipped) for
//         sliding thumb + lens + animated refraction highlight.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';

import { GlassLayers } from './GlassLayers';
import {
  GLASS_RADIUS_PILL,
  PILL_HEIGHT,
  PILL_INSET,
  LG,
  SP,
  LONG_PRESS_MS,
  GLASS_SHADOW,
  BLUR,
} from './tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SegmentOption = { key: string; label: string };

export type LiquidGlassSegmentedProps = {
  options: SegmentOption[];
  value: string;
  onChange: (key: string) => void;
  haptics?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  width?: number;
};

// ── Per-option animated label ────────────────────────────────────────────────

function OptionLabel({
  label,
  index,
  isSelected,
  hoverIdx,
  isActive,
}: {
  label: string;
  index: number;
  isSelected: boolean;
  hoverIdx: SharedValue<number>;
  isActive: SharedValue<number>;
}) {
  const selPulse = useSharedValue(1);

  useEffect(() => {
    if (isSelected) {
      selPulse.value = 1.08;
      selPulse.value = withSpring(1, SP.pulse);
    }
  }, [isSelected]);

  const anim = useAnimatedStyle(() => {
    const hov = Math.round(hoverIdx.value) === index;
    const scrubScale = interpolate(isActive.value, [0, 1], [1, hov ? 1.06 : 0.88]);
    return {
      transform: [{ scale: scrubScale * selPulse.value }],
      opacity: interpolate(isActive.value, [0, 1], [isSelected ? 1 : 0.72, hov ? 1 : 0.22]),
    };
  });

  return (
    <View style={st.optSlot}>
      <Animated.Text
        style={[st.optLabel, isSelected && st.optLabelSel, anim]}
        numberOfLines={1}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

// Overflow padding so scaled thumb/lens aren't clipped
const OVERFLOW_PAD = 8;

// ── Main component ───────────────────────────────────────────────────────────

export function LiquidGlassSegmented({
  options,
  value,
  onChange,
  haptics: hapticsEnabled = true,
  disabled = false,
  style,
  width: widthProp,
}: LiquidGlassSegmentedProps) {
  const selIdx = options.findIndex(o => o.key === value);
  const numOpts = options.length;

  const trackWidth = widthProp ?? numOpts * 78;
  const slotW = trackWidth > PILL_INSET * 2 ? (trackWidth - PILL_INSET * 2) / numOpts : 0;
  const thumbR = GLASS_RADIUS_PILL - 2;

  const slotWSV = useSharedValue(slotW);
  const numOptsSV = useSharedValue(numOpts);
  const trackWSV = useSharedValue(trackWidth);
  useEffect(() => { slotWSV.value = slotW; }, [slotW]);
  useEffect(() => { numOptsSV.value = numOpts; }, [numOpts]);
  useEffect(() => { trackWSV.value = trackWidth; }, [trackWidth]);

  const onChangeRef = useRef(onChange);
  const optionsRef = useRef(options);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { optionsRef.current = options; }, [options]);

  const isActive = useSharedValue(0);
  const hoverIdx = useSharedValue(selIdx);
  const selSlideX = useSharedValue(0);
  const selPillScale = useSharedValue(1);
  const lensX = useSharedValue(0);
  const lensScale = useSharedValue(1);
  const hasLayout = useRef(false);
  const prevSelIdx = useRef(selIdx);

  useEffect(() => {
    if (slotW <= 0) return;
    const tx = PILL_INSET + selIdx * slotW;
    if (!hasLayout.current) {
      hasLayout.current = true;
      selSlideX.value = tx;
      hoverIdx.value = selIdx;
      lensX.value = PILL_INSET + selIdx * slotW + slotW / 2;
    } else {
      selSlideX.value = withSpring(tx, SP.slide);
      if (prevSelIdx.current !== selIdx) {
        selPillScale.value = 1.08;
        selPillScale.value = withSpring(1, SP.bounce);
      }
    }
    prevSelIdx.current = selIdx;
  }, [selIdx, slotW]);

  // ── Haptics ────────────────────────────────────────────────────
  const hLight = useCallback(() => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [hapticsEnabled]);
  const hMedium = useCallback(() => {
    if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [hapticsEnabled]);
  const hTick = useCallback(() => {
    if (hapticsEnabled) Haptics.selectionAsync();
  }, [hapticsEnabled]);

  // ── Commit ─────────────────────────────────────────────────────
  const commitSelect = useCallback((idx: number) => {
    const opts = optionsRef.current;
    if (idx >= 0 && idx < opts.length) {
      onChangeRef.current(opts[idx].key);
    }
    hMedium();
  }, [hMedium]);

  // ── Gestures ───────────────────────────────────────────────────
  const slidePan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart((e) => {
      const sw = slotWSV.value;
      const nO = numOptsSV.value;
      if (sw <= 0) return;
      const cx = Math.max(PILL_INSET + sw * 0.5, Math.min(PILL_INSET + sw * (nO - 0.5), e.x));
      const si = Math.max(0, Math.min(nO - 1, Math.floor((cx - PILL_INSET) / sw)));
      hoverIdx.value = si;
      lensX.value = PILL_INSET + si * sw + sw / 2;
      isActive.value = withSpring(1, SP.lens);
      lensScale.value = withSpring(1.06, SP.lens);
      runOnJS(hMedium)();
    })
    .onUpdate((e) => {
      const sw = slotWSV.value;
      const nO = numOptsSV.value;
      if (sw <= 0 || isActive.value < 0.1) return;
      const cx = Math.max(PILL_INSET + sw * 0.5, Math.min(PILL_INSET + sw * (nO - 0.5), e.x));
      lensX.value = cx;
      const ni = Math.max(0, Math.min(nO - 1, Math.floor((cx - PILL_INSET) / sw)));
      if (ni !== hoverIdx.value) {
        hoverIdx.value = ni;
        runOnJS(hTick)();
      }
    })
    .onEnd(() => {
      const sw = slotWSV.value;
      lensX.value = withSpring(PILL_INSET + hoverIdx.value * sw + sw / 2, SP.slide);
      selSlideX.value = withSpring(PILL_INSET + hoverIdx.value * sw, SP.slide);
      isActive.value = withSpring(0, SP.lens);
      lensScale.value = withSpring(1, SP.lens);
      runOnJS(commitSelect)(hoverIdx.value);
    })
    .onFinalize(() => {
      if (isActive.value > 0.3) {
        isActive.value = withSpring(0, SP.lens);
        lensScale.value = withSpring(1, SP.lens);
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(LONG_PRESS_MS - 10)
    .onEnd((e, success) => {
      if (!success) return;
      const sw = slotWSV.value;
      const nO = numOptsSV.value;
      if (sw <= 0) return;
      const idx = Math.max(0, Math.min(nO - 1, Math.floor((e.x - PILL_INSET) / sw)));
      runOnJS(commitSelect)(idx);
    });

  const gesture = Gesture.Race(slidePan, tapGesture);

  // ── Animated styles ────────────────────────────────────────────

  // Selected pill — slides + scale pulse
  const selPillStyle = useAnimatedStyle(() => ({
    width: slotWSV.value,
    transform: [
      { translateX: selSlideX.value },
      { scaleX: selPillScale.value },
      { scaleY: selPillScale.value },
    ],
    opacity: interpolate(isActive.value, [0, 0.5, 1], [1, 0.55, 0.08]),
  }));

  // Animated refraction highlight on the thumb — moves as thumb slides
  const refractionStyle = useAnimatedStyle(() => {
    const tw = trackWSV.value;
    if (tw <= 0) return { opacity: 0 };
    const thumbCenter = selSlideX.value + slotWSV.value / 2;
    const normalizedX = thumbCenter / tw;
    return {
      opacity: 0.55,
      transform: [
        { translateX: interpolate(normalizedX, [0, 1], [-slotWSV.value * 0.4, slotWSV.value * 0.4]) },
        { rotate: `${interpolate(normalizedX, [0, 1], [-12, 12])}deg` },
      ],
    };
  });

  // Lens bubble
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

  // ── Render ─────────────────────────────────────────────────────
  return (
    <View style={[st.container, style, { width: trackWidth }]}>
      <GestureDetector gesture={gesture}>
        <View style={st.wrapper}>
          {/* Glass track — overflow hidden clips blur layers cleanly */}
          <View style={[st.track, { width: trackWidth }]}>
            <GlassLayers radius={GLASS_RADIUS_PILL} />
          </View>

          {/* Overlay — overflow visible so thumb/lens scale isn't clipped */}
          <View style={st.overlay} pointerEvents="box-none">
            {/* Selected pill thumb */}
            {slotW > 0 && (
              <Animated.View pointerEvents="none" style={[st.selPill, selPillStyle]}>
                <View style={[StyleSheet.absoluteFillObject, { borderRadius: thumbR, backgroundColor: LG.selPill }]} />
                {/* Top specular */}
                <LinearGradient
                  colors={LG.selSpecTop as unknown as string[]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.55 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: thumbR }]}
                  pointerEvents="none"
                />
                {/* Animated refraction — diagonal highlight that shifts as thumb moves */}
                <Animated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFillObject, { borderRadius: thumbR, overflow: 'hidden' }, refractionStyle]}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0.06)', 'transparent']}
                    locations={[0, 0.35, 0.65, 1]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                </Animated.View>
                {/* Bottom depth */}
                <LinearGradient
                  colors={LG.selDepth as unknown as string[]}
                  start={{ x: 0.5, y: 0.6 }}
                  end={{ x: 0.5, y: 1 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: thumbR }]}
                  pointerEvents="none"
                />
                {/* Inner border rim */}
                <View
                  style={[StyleSheet.absoluteFillObject, { borderRadius: thumbR, borderWidth: 1, borderColor: LG.selPillDark }]}
                  pointerEvents="none"
                />
                {/* Bright top-edge highlight for refraction feel */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.32)', 'transparent']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.18 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: thumbR }]}
                  pointerEvents="none"
                />
              </Animated.View>
            )}

            {/* Lens bubble — long-press scrub */}
            {slotW > 0 && (
              <Animated.View pointerEvents="none" style={[st.lens, lensStyle]}>
                <BlurView intensity={BLUR.lens} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: GLASS_RADIUS_PILL }]} />
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: LG.lensFill, borderRadius: GLASS_RADIUS_PILL }]} />
                <LinearGradient
                  colors={LG.lensSpec as unknown as string[]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.6 }}
                  style={[StyleSheet.absoluteFillObject, { borderRadius: GLASS_RADIUS_PILL }]}
                  pointerEvents="none"
                />
                <View
                  style={[StyleSheet.absoluteFillObject, { borderRadius: GLASS_RADIUS_PILL, borderWidth: 1, borderColor: LG.lensBorder }]}
                  pointerEvents="none"
                />
              </Animated.View>
            )}

            {/* Option labels */}
            <View style={st.labelsRow}>
              {options.map((opt, i) => (
                <OptionLabel
                  key={opt.key}
                  label={opt.label}
                  index={i}
                  isSelected={opt.key === value}
                  hoverIdx={hoverIdx}
                  isActive={isActive}
                />
              ))}
            </View>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: {
    height: PILL_HEIGHT + OVERFLOW_PAD * 2,
    alignSelf: 'flex-start',
  },
  wrapper: {
    paddingVertical: OVERFLOW_PAD,
  },
  track: {
    height: PILL_HEIGHT,
    borderRadius: GLASS_RADIUS_PILL,
    overflow: 'hidden',
    ...GLASS_SHADOW,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: OVERFLOW_PAD,
    height: PILL_HEIGHT,
    overflow: 'visible',
  },
  selPill: {
    position: 'absolute',
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: GLASS_RADIUS_PILL - 2,
    overflow: 'hidden',
  },
  lens: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    borderRadius: GLASS_RADIUS_PILL,
    overflow: 'hidden',
    zIndex: 5,
  },
  labelsRow: {
    flexDirection: 'row',
    flex: 1,
    marginHorizontal: PILL_INSET,
    zIndex: 10,
  },
  optSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: LG.textFull,
    letterSpacing: -0.1,
  },
  optLabelSel: {
    color: LG.textDark,
    fontWeight: '700',
  },
});
