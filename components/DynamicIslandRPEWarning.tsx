/**
 * DynamicIslandRPEWarning
 *
 * A notification that expands from the Dynamic Island (or floats as a pill
 * on older iPhones) when the user logs a low RPE.
 *
 * Works on every iPhone:
 *  • 14 Pro / 15 / 15 Pro / 16 / 16 Plus / 16 Pro  → 126 × 37 pt pill
 *  • 16 Pro Max (≥440pt wide)                       → 140 × 37 pt pill
 *  • Non-DI iPhones (notch/pill/no-cutout)          → floating pill at top
 *
 * Triggered in two contexts:
 *  • context="active"  — fires immediately after a set's RPE is committed < 7
 *  • context="post"    — fires after workout is finished, avg RPE < 7
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Switch,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

// ─── Device detection ─────────────────────────────────────────────────────────

const { width: SW } = Dimensions.get('window');

/**
 * All Dynamic Island iPhones launched to date have insets.top ≥ 51 pt.
 * Notch iPhones (X → 14 non-pro) max out at ~47 pt.
 * Use 51 as the threshold — safe gap between the two families.
 */
function useDeviceKind() {
  const insets = useSafeAreaInsets();
  const hasDI = insets.top >= 51;
  // iPhone 16 Pro Max has a wider pill (140pt) vs 126pt on all others
  const pillW = SW >= 440 ? 140 : 126;
  // On DI devices the island starts at y≈6 from the top of the screen
  const pillTop = hasDI ? 6 : Math.max(insets.top - 20, 4);
  return { hasDI, pillW, pillTop };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

const PILL_H  = 37;
const PILL_BR = 20;
const CARD_W  = SW - 40;
const CARD_H  = 130;
const CARD_BR = 26;

// ─── Design tokens ────────────────────────────────────────────────────────────

const BLACK      = '#000000';
const WHITE      = '#ffffff';
const WHITE_DIM  = 'rgba(255,255,255,0.55)';
const WHITE_FAINT= 'rgba(255,255,255,0.10)';
const ORANGE     = '#FF9F0A';   // iOS system orange

// ─── Animation config ─────────────────────────────────────────────────────────

const SPRING          = { damping: 24, stiffness: 280, mass: 0.85 };
const AUTO_DISMISS_MS = 5500;

// ─── Props ────────────────────────────────────────────────────────────────────

export type DynamicIslandRPEWarningProps = {
  visible: boolean;
  rpe: number;
  /** Name of the exercise that triggered the warning (shown in active context). */
  exerciseName?: string;
  /** 'active' = shown mid-workout after a set; 'post' = shown after session ends. */
  context?: 'active' | 'post';
  isInjured: boolean;
  onInjuredChange: (val: boolean) => void;
  onDismiss: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DynamicIslandRPEWarning({
  visible,
  rpe,
  exerciseName,
  context = 'post',
  isInjured,
  onInjuredChange,
  onDismiss,
}: DynamicIslandRPEWarningProps) {
  const { pillW, pillTop } = useDeviceKind();

  const width     = useSharedValue(pillW);
  const height    = useSharedValue(PILL_H);
  const radius    = useSharedValue(PILL_BR);
  const opacity   = useSharedValue(0);
  const contentOp = useSharedValue(0);
  const scale     = useSharedValue(0.88);

  const triggerHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const expand = useCallback(() => {
    runOnJS(triggerHaptic)();
    width.value     = withSpring(CARD_W,  SPRING);
    height.value    = withSpring(CARD_H,  SPRING);
    radius.value    = withSpring(CARD_BR, SPRING);
    scale.value     = withSpring(1,       SPRING);
    contentOp.value = withDelay(
      200,
      withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) })
    );
  }, [width, height, radius, scale, contentOp, triggerHaptic]);

  const collapse = useCallback(() => {
    contentOp.value = withTiming(0, { duration: 100 });
    width.value     = withDelay(80, withSpring(pillW,   SPRING));
    height.value    = withDelay(80, withSpring(PILL_H,  SPRING));
    radius.value    = withDelay(80, withSpring(PILL_BR, SPRING));
    scale.value     = withDelay(80, withSpring(0.88,    SPRING));
    opacity.value   = withDelay(300, withTiming(0, { duration: 180 }));
  }, [width, height, radius, opacity, contentOp, scale, pillW]);

  useEffect(() => {
    if (visible) {
      // Reset to pill dimensions first
      width.value     = pillW;
      height.value    = PILL_H;
      radius.value    = PILL_BR;
      scale.value     = 0.88;
      contentOp.value = 0;
      opacity.value   = withTiming(1, { duration: 180 });

      // Brief pause so pill is visible, then bloom open like a notification
      const expandTimer  = setTimeout(expand, 380);
      const dismissTimer = setTimeout(() => {
        collapse();
        setTimeout(onDismiss, 500);
      }, AUTO_DISMISS_MS);

      return () => { clearTimeout(expandTimer); clearTimeout(dismissTimer); };
    } else {
      collapse();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    width:        width.value,
    height:       height.value,
    borderRadius: radius.value,
    opacity:      opacity.value,
    transform:    [{ scale: scale.value }],
  }));

  const contentStyle  = useAnimatedStyle(() => ({ opacity: contentOp.value }));
  const pillIconStyle = useAnimatedStyle(() => ({ opacity: 1 - contentOp.value }));

  // ── Message copy varies by context ────────────────────────────────────────
  const headline = context === 'active'
    ? `Push harder next set`
    : `Aim higher next session`;

  const subtext = context === 'active'
    ? `RPE ${rpe} is below target — drive to RPE 7+`
    : `Average RPE of ${rpe} — leave less in the tank`;

  return (
    <View
      style={[styles.root, { top: pillTop }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <Pressable onPress={() => { collapse(); setTimeout(onDismiss, 420); }}>
        <Animated.View style={[styles.island, containerStyle]}>

          {/* ── Pill state: dot + RPE number ── */}
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.pillCenter, pillIconStyle]}>
            <View style={styles.pillDot} />
            <Text style={styles.pillLabel}>RPE {rpe}</Text>
          </Animated.View>

          {/* ── Expanded notification content ── */}
          <Animated.View style={[styles.content, contentStyle]}>

            {/* Top row: badge + dismiss */}
            <View style={styles.topRow}>
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>
                  {exerciseName ? exerciseName : 'RPE Warning'} · {rpe}
                </Text>
              </View>
              <Text style={styles.dismissHint}>tap to dismiss</Text>
            </View>

            {/* Main message */}
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subtext}>{subtext}</Text>

            {/* Divider + injured toggle — shown in both contexts */}
            <View style={styles.divider} />
            <View style={styles.injuredRow}>
              <Text style={styles.injuredLabel}>
                {context === 'active' ? 'Managing injury / recovery' : 'Going easy (injury / recovery)'}
              </Text>
              <Switch
                value={isInjured}
                onValueChange={onInjuredChange}
                trackColor={{ false: WHITE_FAINT, true: ORANGE }}
                thumbColor={WHITE}
                ios_backgroundColor={WHITE_FAINT}
              />
            </View>

          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },

  // Pure black island — no glass, no blur, matches hardware
  island: {
    backgroundColor: BLACK,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.60,
    shadowRadius: 24,
    elevation: 30,
  },

  // ── Pill state ─────────────────────────────────────────────────────────────
  pillCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ORANGE,
  },
  pillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: WHITE,
    letterSpacing: -0.2,
  },

  // ── Expanded content ───────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 12,
    width: '100%',
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,159,10,0.14)',
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: ORANGE,
    letterSpacing: 0.1,
  },
  dismissHint: {
    fontSize: 11,
    fontWeight: '400',
    color: WHITE_DIM,
  },
  headline: {
    fontSize: 15,
    fontWeight: '600',
    color: WHITE,
    letterSpacing: -0.3,
  },
  subtext: {
    fontSize: 12,
    fontWeight: '400',
    color: WHITE_DIM,
    letterSpacing: -0.1,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.09)',
    marginTop: 8,
  },
  injuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  injuredLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: WHITE_DIM,
    letterSpacing: -0.1,
  },
});
