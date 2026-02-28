// ─────────────────────────────────────────────────────────────────────────────
// LiquidGlassPillGroup  +  ScrubPill
//
// iOS 26 Liquid Glass segmented pill — fixed, left-aligned, no collapse.
//
// Behaviour:
//  • Tap option → select
//  • Long-press + drag → LENS SCRUB: lens follows finger, haptic per slot, release commits
//
// Visual: 7-layer glass stack (blur, fill, specular, lensing, depth, border)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
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
  FadeIn,
  type SharedValue,
} from 'react-native-reanimated';

// ── Design tokens ────────────────────────────────────────────────────────────

const TRACK_H  = 40;
const INSET    = 3;
const PILL_R   = 20;
const TRACK_R  = 20;

const C = {
  text:       '#C6C6C6',
  textDim:    'rgba(198,198,198,0.50)',
  dark:       '#2F3031',
  // Glass fills — translucent, let blur show through
  fill:       'rgba(47,48,49,0.26)',
  fillHover:  'rgba(47,48,49,0.18)',
  // Borders
  border:     'rgba(198,198,198,0.16)',
  borderSel:  'rgba(198,198,198,0.36)',
  borderBright: 'rgba(255,255,255,0.22)',
  // Selected indicator
  selPill:    'rgba(198,198,198,0.92)',
  selPillDark:'rgba(47,48,49,0.18)',
  // Lens
  lensFill:   'rgba(198,198,198,0.12)',
  lensBorder: 'rgba(198,198,198,0.40)',
} as const;

// Spring presets — tuned for iOS 26 "bubbly but controlled"
const SP = {
  slide: { damping: 18, stiffness: 280, mass: 0.7 },
  lens:  { damping: 14, stiffness: 440, mass: 0.22 },
  press: { damping: 16, stiffness: 420, mass: 0.35 },
} as const;

const LONG_MS = 280;

// ── Shared glass layer helper ────────────────────────────────────────────────

function GlassLayers({ radius, intensity = 26 }: { radius: number; intensity?: number }) {
  return (
    <>
      <BlurView intensity={intensity} tint="dark" style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: C.fill, borderRadius: radius }]} />
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.04)', 'transparent']}
        start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.22 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.16)']}
        start={{ x: 0.5, y: 0.6 }} end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        pointerEvents="none"
      />
      <View
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius, borderWidth: 1, borderColor: C.border }]}
        pointerEvents="none"
      />
    </>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type PillOption = { key: string; label: string };

export type LiquidGlassPillGroupProps = {
  options: PillOption[];
  value: string;
  onChange: (key: string) => void;
  haptics?: boolean;
  disabled?: boolean;
  style?: object;
  /** Width of the track; default: options.length * 78 */
  width?: number;
};

// ── Per-option label ─────────────────────────────────────────────────────────

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
      selPulse.value = withSpring(1, { damping: 12, stiffness: 380, mass: 0.4 });
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

// ── Main component ───────────────────────────────────────────────────────────

export function LiquidGlassPillGroup({
  options,
  value,
  onChange,
  haptics: hapticsEnabled = true,
  disabled = false,
  style,
  width: widthProp,
}: LiquidGlassPillGroupProps) {
  const selIdx  = options.findIndex(o => o.key === value);
  const numOpts = options.length;

  // Track width — fixed, left-aligned
  const trackWidth = widthProp ?? numOpts * 78;
  const slotW = trackWidth > INSET * 2 ? (trackWidth - INSET * 2) / numOpts : 0;

  // Shared values for worklets
  const slotWSV   = useSharedValue(slotW);
  const numOptsSV = useSharedValue(numOpts);
  useEffect(() => { slotWSV.value = slotW; }, [slotW]);
  useEffect(() => { numOptsSV.value = numOpts; }, [numOpts]);

  // Refs for stale-closure safety
  const onChangeRef = useRef(onChange);
  const optionsRef  = useRef(options);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { optionsRef.current = options; }, [options]);

  // Lens / slide shared values
  const isActive     = useSharedValue(0);
  const hoverIdx     = useSharedValue(selIdx);
  const selSlideX    = useSharedValue(0);
  const selPillScale = useSharedValue(1);
  const lensX        = useSharedValue(0);
  const lensScale    = useSharedValue(1);
  const hasLayout    = useRef(false);
  const prevSelIdx   = useRef(selIdx);

  // Sync selected pill position + scale pulse
  useEffect(() => {
    if (slotW <= 0) return;
    const tx = INSET + selIdx * slotW;
    if (!hasLayout.current) {
      hasLayout.current = true;
      selSlideX.value = tx;
      hoverIdx.value  = selIdx;
      lensX.value     = INSET + selIdx * slotW + slotW / 2;
    } else {
      selSlideX.value = withSpring(tx, SP.slide);
      if (prevSelIdx.current !== selIdx) {
        selPillScale.value = 1.08;
        selPillScale.value = withSpring(1, { damping: 14, stiffness: 360, mass: 0.35 });
      }
    }
    prevSelIdx.current = selIdx;
  }, [selIdx, slotW]);

  // ── Haptics ────────────────────────────────────────────────────
  const hLight  = useCallback(() => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, [hapticsEnabled]);
  const hMedium = useCallback(() => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }, [hapticsEnabled]);
  const hTick   = useCallback(() => { if (hapticsEnabled) Haptics.selectionAsync(); }, [hapticsEnabled]);

  // ── Commit selection ───────────────────────────────────────────
  const commitSelect = useCallback((idx: number) => {
    const opts = optionsRef.current;
    if (idx >= 0 && idx < opts.length) {
      onChangeRef.current(opts[idx].key);
    }
    hMedium();
  }, [hMedium]);

  const tapSelect = useCallback((key: string) => {
    if (disabled) return;
    if (key !== value) {
      onChange(key);
      hLight();
    }
  }, [disabled, value, onChange, hLight]);

  // ── Gestures ───────────────────────────────────────────────────
  const slidePan = Gesture.Pan()
    .activateAfterLongPress(LONG_MS)
    .onStart((e) => {
      const sw = slotWSV.value;
      const nO = numOptsSV.value;
      if (sw <= 0) return;
      const cx = Math.max(INSET + sw * 0.5, Math.min(INSET + sw * (nO - 0.5), e.x));
      const si = Math.max(0, Math.min(nO - 1, Math.floor((cx - INSET) / sw)));
      hoverIdx.value = si;
      lensX.value    = INSET + si * sw + sw / 2;
      isActive.value = withSpring(1, SP.lens);
      lensScale.value = withSpring(1.06, SP.lens);
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
      lensX.value     = withSpring(INSET + hoverIdx.value * sw + sw / 2, SP.slide);
      selSlideX.value = withSpring(INSET + hoverIdx.value * sw, SP.slide);
      isActive.value  = withSpring(0, SP.lens);
      lensScale.value = withSpring(1, SP.lens);
      runOnJS(commitSelect)(hoverIdx.value);
    })
    .onFinalize(() => {
      if (isActive.value > 0.3) {
        isActive.value  = withSpring(0, SP.lens);
        lensScale.value = withSpring(1, SP.lens);
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(LONG_MS - 10)
    .onEnd((e, success) => {
      if (!success) return;
      const sw = slotWSV.value;
      const nO = numOptsSV.value;
      if (sw <= 0) return;
      const idx = Math.max(0, Math.min(nO - 1, Math.floor((e.x - INSET) / sw)));
      runOnJS(commitSelect)(idx);
    });

  const gesture = Gesture.Race(slidePan, tapGesture);

  // ── Animated styles ────────────────────────────────────────────

  // Selected pill slider — slides + scale pulse on change
  const selPillStyle = useAnimatedStyle(() => ({
    width: slotWSV.value,
    transform: [
      { translateX: selSlideX.value },
      { scaleX: selPillScale.value },
      { scaleY: selPillScale.value },
    ],
    opacity: interpolate(isActive.value, [0, 0.5, 1], [1, 0.55, 0.08]),
  }));

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
        <View style={[st.track, { width: trackWidth }]}>
            <GlassLayers radius={TRACK_R} intensity={28} />

            {/* Selected pill indicator — slides between slots */}
            {slotW > 0 && (
              <Animated.View pointerEvents="none" style={[st.selPill, selPillStyle]}>
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
            )}

            {/* Lens bubble — appears during long-press scrub */}
            {slotW > 0 && (
              <Animated.View pointerEvents="none" style={[st.lens, lensStyle]}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
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
            )}

            {/* Option labels */}
            {options.map((opt, i) => (
              <Pressable
                key={opt.key}
                style={st.optSlot}
                onPress={() => tapSelect(opt.key)}
              >
                <OptionLabel
                  label={opt.label}
                  index={i}
                  isSelected={opt.key === value}
                  hoverIdx={hoverIdx}
                  isActive={isActive}
                />
              </Pressable>
            ))}
        </View>
      </GestureDetector>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ScrubPill
// ─────────────────────────────────────────────────────────────────────────────

export type ScrubPillProps = {
  label: string;
  onScrubChange?: (delta: number) => void;
  onTap?: () => void;
  /** When false, disables long-press slide-to-scrub; only tap works. Default true. */
  scrubEnabled?: boolean;
  style?: object;
  haptics?: boolean;
};

export function ScrubPill({
  label,
  onScrubChange,
  onTap,
  scrubEnabled = true,
  style,
  haptics: hapticsEnabled = true,
}: ScrubPillProps) {
  const isActive  = useSharedValue(0);
  const lensScale = useSharedValue(1);
  const accX      = useSharedValue(0);
  const press     = useSharedValue(0);
  const STEP_PX   = 40;

  const hMedium = useCallback(() => { if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }, [hapticsEnabled]);
  const hTick   = useCallback(() => { if (hapticsEnabled) Haptics.selectionAsync(); }, [hapticsEnabled]);

  const onScrubRef = useRef(onScrubChange);
  useEffect(() => { onScrubRef.current = onScrubChange; }, [onScrubChange]);
  const doStep = useCallback((d: number) => { onScrubRef.current?.(d); hTick(); }, [hTick]);

  const scrubPan = Gesture.Pan()
    .activateAfterLongPress(LONG_MS)
    .onStart(() => {
      isActive.value  = withSpring(1, SP.lens);
      lensScale.value = withSpring(1.05, SP.lens);
      accX.value      = 0;
      runOnJS(hMedium)();
    })
    .onUpdate((e) => {
      if (isActive.value < 0.1) return;
      const total = e.translationX;
      const steps = Math.floor(total / STEP_PX);
      const prev  = Math.floor(accX.value / STEP_PX);
      if (steps !== prev) {
        accX.value = total;
        runOnJS(doStep)(steps - prev);
      }
    })
    .onEnd(() => {
      isActive.value  = withSpring(0, SP.lens);
      lensScale.value = withSpring(1, SP.lens);
      runOnJS(hMedium)();
    })
    .onFinalize(() => {
      if (isActive.value > 0.3) {
        isActive.value  = withSpring(0, SP.lens);
        lensScale.value = withSpring(1, SP.lens);
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(scrubEnabled ? LONG_MS - 10 : 500)
    .onEnd((_e, success) => {
      if (success && onTap) runOnJS(onTap)();
    });

  const tapPressIn = Gesture.Tap()
    .onBegin(() => { press.value = withSpring(1, SP.press); })
    .onFinalize(() => { press.value = withSpring(0, SP.press); });

  const gesture = scrubEnabled
    ? Gesture.Simultaneous(Gesture.Race(scrubPan, tapGesture), tapPressIn)
    : Gesture.Simultaneous(tapGesture, tapPressIn);

  const pillAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(isActive.value, [0, 1], [
        interpolate(press.value, [0, 1], [1, 0.965]),
        lensScale.value,
      ]) },
    ],
  }));

  const specularAnim = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.max(isActive.value, press.value),
      [0, 1],
      [0, 0.22],
    ),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[st.scrubPill, style, pillAnim]}>
        <GlassLayers radius={PILL_R} />
        {/* Interactive specular */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_R }, specularAnim]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.85 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_R }]}
          />
        </Animated.View>
        <Animated.Text key={label} entering={FadeIn.duration(180)} style={st.scrubLabel} numberOfLines={1}>{label}</Animated.Text>
        <Text style={st.scrubChevron}>›</Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container: {
    height: TRACK_H,
    alignSelf: 'flex-start',
  },

  // ── Track ───────────────────────────────────────────────────────
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
  selPill: {
    position: 'absolute',
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
  optSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  optLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: C.text,
    letterSpacing: -0.1,
  },
  optLabelSel: {
    color: C.dark,
    fontWeight: '700',
  },

  // ── ScrubPill ───────────────────────────────────────────────────
  scrubPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TRACK_H,
    paddingHorizontal: 18,
    borderRadius: PILL_R,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  scrubLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    letterSpacing: -0.2,
    zIndex: 1,
  },
  scrubChevron: {
    fontSize: 15,
    fontWeight: '500',
    color: C.textDim,
    marginLeft: 5,
    zIndex: 1,
  },
});
