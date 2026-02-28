// ─────────────────────────────────────────────────────────────────
// LiquidGlassPillSlider
//
// A segmented control that:
//  • Tap → select normally (light haptic)
//  • Long-press (320ms) → activates "lens mode":
//      - A liquid-glass bubble appears over the hovered slot
//      - Drag left/right to browse options, selection haptic per slot
//      - Release → commits the hovered option (medium haptic)
//
// Visual language: Liquid Glass cheatsheet
//   blur + specular gradient + border rim + springy motion
// ─────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
import { Glass, Colors } from '../../constants/theme';

// ── Constants ────────────────────────────────────────────────────
const SPRING_SNAPPY = { damping: 22, stiffness: 300, mass: 0.8 };
const SPRING_LENS   = { damping: 16, stiffness: 400, mass: 0.28 };
const LONG_PRESS_MS = 320;
const INSET         = 3;   // inner padding so pill doesn't touch track edge
const TRACK_H       = 44;

// ── Types ────────────────────────────────────────────────────────
export type LiquidGlassPillSliderProps = {
  options: string[];
  value: string;
  onChange: (next: string) => void;
  style?: object;
  disabled?: boolean;
};

// ── Per-option label — scale + opacity react to lens hover ───────
function SliderOption({
  label,
  index,
  isSelected,
  hoverIdx,
  isActive,
  onTap,
}: {
  label: string;
  index: number;
  isSelected: boolean;
  hoverIdx: SharedValue<number>;
  isActive: SharedValue<number>;
  onTap: () => void;
}) {
  const animStyle = useAnimatedStyle(() => {
    const isHov = Math.round(hoverIdx.value) === index;
    const scl   = interpolate(isActive.value, [0, 1], [1,  isHov ? 1.06 : 0.84]);
    const opc   = interpolate(isActive.value, [0, 1], [1,  isHov ? 1.00 : 0.26]);
    return {
      transform: [{ scale: scl }],
      opacity:   opc,
    };
  });

  return (
    <Pressable onPress={onTap} style={s.btn}>
      <Animated.Text style={[s.label, isSelected && s.labelSel, animStyle]}>
        {label}
      </Animated.Text>
    </Pressable>
  );
}

// ── LiquidGlassPillSlider ────────────────────────────────────────
export function LiquidGlassPillSlider({
  options,
  value,
  onChange,
  style,
  disabled = false,
}: LiquidGlassPillSliderProps) {
  const [trackW, setTrackW] = useState(0);

  const selIdx  = options.indexOf(value);
  const numOpts = options.length;
  const slotW   = trackW > INSET * 2 ? (trackW - INSET * 2) / numOpts : 0;

  // ── Shared values accessible inside worklets ──────────────────
  const slotWSV    = useSharedValue(slotW);
  const numOptsSV  = useSharedValue(numOpts);
  useEffect(() => { slotWSV.value   = slotW;   }, [slotW]);
  useEffect(() => { numOptsSV.value = numOpts; }, [numOpts]);

  // ── Refs for JS callbacks (avoid stale closures) ──────────────
  const onChangeRef = useRef(onChange);
  const optionsRef  = useRef(options);
  const selIdxRef   = useRef(selIdx);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { optionsRef.current  = options;  }, [options]);
  useEffect(() => { selIdxRef.current   = selIdx;   }, [selIdx]);

  // ── Animation shared values ───────────────────────────────────
  const isActive  = useSharedValue(0);   // 0 = normal, 1 = lens mode
  const hoverIdx  = useSharedValue(selIdx);
  const selSlideX = useSharedValue(0);   // translateX of white selected pill
  const lensX     = useSharedValue(0);   // center X of floating lens
  const lensScale = useSharedValue(1);

  const hasLayout = useRef(false);

  // Sync selected pill position whenever value or track layout changes
  useEffect(() => {
    if (slotW <= 0) return;
    const tx = INSET + selIdx * slotW;
    if (!hasLayout.current) {
      hasLayout.current = true;
      selSlideX.value   = tx;
      hoverIdx.value    = selIdx;
      lensX.value       = INSET + selIdx * slotW + slotW / 2;
    } else {
      selSlideX.value = withSpring(tx, SPRING_SNAPPY);
    }
  }, [selIdx, slotW]);

  // ── JS callbacks (called from worklets via runOnJS) ───────────
  const hapticLight  = useCallback(() =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),  []);
  const hapticMedium = useCallback(() =>
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), []);
  const hapticTick   = useCallback(() =>
    Haptics.selectionAsync(), []);

  const commitIdx = useCallback((idx: number) => {
    const opts = optionsRef.current;
    if (idx >= 0 && idx < opts.length) {
      onChangeRef.current(opts[idx]);
    }
  }, []);

  const tapSelect = useCallback((idx: number) => {
    const opts = optionsRef.current;
    if (!disabled && idx >= 0 && idx < opts.length && opts[idx] !== value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChangeRef.current(opts[idx]);
    }
  }, [disabled, value]);

  // ── Gestures ─────────────────────────────────────────────────
  // Pan with activateAfterLongPress — handles lens mode
  const slidePan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart((e) => {
      const sw  = slotWSV.value;
      const nO  = numOptsSV.value;
      if (sw <= 0) return;
      // Snap to slot the finger is on
      const cx  = Math.max(INSET + sw * 0.5, Math.min(INSET + sw * (nO - 0.5), e.x));
      const si  = Math.max(0, Math.min(nO - 1, Math.floor((cx - INSET) / sw)));
      hoverIdx.value  = si;
      lensX.value     = INSET + si * sw + sw / 2;
      isActive.value  = withSpring(1, SPRING_LENS);
      lensScale.value = withSpring(1.07, SPRING_LENS);
      runOnJS(hapticLight)();
    })
    .onUpdate((e) => {
      const sw = slotWSV.value;
      const nO = numOptsSV.value;
      if (sw <= 0 || isActive.value < 0.1) return;
      // Lens follows finger continuously (clamped to track content area)
      const cx = Math.max(INSET + sw * 0.5, Math.min(INSET + sw * (nO - 0.5), e.x));
      lensX.value = cx;
      // Discrete hover index for haptics + commit
      const ni = Math.max(0, Math.min(nO - 1, Math.floor((cx - INSET) / sw)));
      if (ni !== hoverIdx.value) {
        hoverIdx.value = ni;
        runOnJS(hapticTick)();
      }
    })
    .onEnd(() => {
      // Snap lens to committed slot, then fade lens out
      const sw = slotWSV.value;
      lensX.value     = withSpring(INSET + hoverIdx.value * sw + sw / 2, SPRING_SNAPPY);
      selSlideX.value = withSpring(INSET + hoverIdx.value * sw, SPRING_SNAPPY);
      isActive.value  = withSpring(0, SPRING_LENS);
      lensScale.value = withSpring(1, SPRING_LENS);
      runOnJS(commitIdx)(hoverIdx.value);
      runOnJS(hapticMedium)();
    })
    .onFinalize(() => {
      // Safety deactivation (e.g. cancelled gesture)
      if (isActive.value > 0.3) {
        isActive.value  = withSpring(0, SPRING_LENS);
        lensScale.value = withSpring(1, SPRING_LENS);
      }
    });

  // Tap — activates quickly, won out over long press on fast taps
  const tapGesture = Gesture.Tap()
    .maxDuration(LONG_PRESS_MS - 10)  // must complete before long press window
    .onEnd((e, success) => {
      if (!success) return;
      const sw  = slotWSV.value;
      const nO  = numOptsSV.value;
      if (sw <= 0) return;
      const idx = Math.max(0, Math.min(nO - 1, Math.floor((e.x - INSET) / sw)));
      runOnJS(tapSelect)(idx);
    });

  // Race: tap wins for quick touches; slidePan wins after long hold
  const gesture = Gesture.Race(slidePan, tapGesture);

  // ── Animated styles ───────────────────────────────────────────
  // Selected pill fades as lens activates
  const selPillStyle = useAnimatedStyle(() => ({
    width:     slotWSV.value,
    transform: [{ translateX: selSlideX.value }],
    opacity:   interpolate(isActive.value, [0, 0.5, 1], [1, 0.6, 0.12]),
  }));

  // Lens bubble slides to hovered slot
  const lensStyle = useAnimatedStyle(() => {
    const sw   = slotWSV.value;
    if (sw <= 0) return { opacity: 0 };
    const lW   = sw + 10;
    return {
      width:   lW,
      opacity: interpolate(isActive.value, [0, 0.2, 1], [0, 0.55, 1]),
      transform: [
        { translateX: lensX.value - lW / 2 },
        { scale: lensScale.value },
      ],
    };
  });

  // ── Render ────────────────────────────────────────────────────
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={[s.track, style]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w !== trackW) setTrackW(w);
        }}
      >
        {/* Track glass: blur + dark fill */}
        <BlurView
          intensity={22}
          tint="dark"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 38 }]}
        />
        <View style={[StyleSheet.absoluteFillObject, s.trackFill, { borderRadius: 38 }]} />

        {/* Selected pill (normal mode — fades when lens appears) */}
        {slotW > 0 && (
          <Animated.View pointerEvents="none" style={[s.selPill, selPillStyle]}>
            {/* Specular on selected pill */}
            <LinearGradient
              colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.06)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.75 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 35 }]}
              pointerEvents="none"
            />
          </Animated.View>
        )}

        {/* ── Lens bubble (liquid glass magnifier) ── */}
        {slotW > 0 && (
          <Animated.View pointerEvents="none" style={[s.lens, lensStyle]}>
            {/* Strong blur — more intense than track */}
            <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFillObject} />
            {/* Light fill tint */}
            <View style={[StyleSheet.absoluteFillObject, s.lensFill]} />
            {/* Bright specular — the "glass sheen" from cheatsheet */}
            <LinearGradient
              colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0.12)', 'transparent']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.65 }}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            />
            {/* Border rim — lensing edge */}
            <View
              style={[StyleSheet.absoluteFillObject, s.lensBorder]}
              pointerEvents="none"
            />
          </Animated.View>
        )}

        {/* Option labels — zIndex above lens for readability */}
        {options.map((opt, i) => (
          <SliderOption
            key={opt}
            label={opt}
            index={i}
            isSelected={opt === value}
            hoverIdx={hoverIdx}
            isActive={isActive}
            onTap={() => {
              if (!disabled && opt !== value) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(opt);
              }
            }}
          />
        ))}
      </View>
    </GestureDetector>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: TRACK_H,
    borderRadius: 38,
    borderWidth: Glass.borderWidth,
    borderColor: Glass.borderSelected,
    paddingHorizontal: INSET,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  trackFill: {
    backgroundColor: 'rgba(47, 48, 49, 0.42)',
  },
  selPill: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    borderRadius: 35,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: 'rgba(47, 48, 49, 0.28)',
    overflow: 'hidden',
  },
  // Lens bubble — slightly taller than the pill, clipped by track overflow:hidden
  lens: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 38,
    overflow: 'hidden',
    zIndex: 5,
  },
  lensFill: {
    backgroundColor: 'rgba(198, 198, 198, 0.14)',
  },
  lensBorder: {
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 198, 0.38)',
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,  // above lens so labels are always readable
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primaryLight,
    letterSpacing: -0.1,
  },
  labelSel: {
    color: Colors.primaryDark,
    fontWeight: '600',
  },
});
