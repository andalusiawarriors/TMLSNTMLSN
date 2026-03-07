/**
 * DynamicIslandRPEWarning
 *
 * Mimics the real Dynamic Island: pure black pill that springs open
 * from the top of the screen after a workout, if avg RPE was below target.
 *
 * Design rules (matching Apple's actual DI behaviour):
 *  • Pure #000 — no glass, no blur, no gradient
 *  • White text only, secondary at 55% opacity
 *  • Springs from exact pill dimensions → wider card
 *  • Content fades in after expansion settles
 *  • Sits at the real DI position (centred, just inside safe area)
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

const { width: SW } = Dimensions.get('window');

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BLACK       = '#000000';
const WHITE       = '#ffffff';
const WHITE_DIM   = 'rgba(255,255,255,0.55)';
const WHITE_FAINT = 'rgba(255,255,255,0.12)';
const ACCENT      = '#FF9F0A';   // iOS system orange — matches Apple's DI live-activity tint

// ─── Pill → card geometry ─────────────────────────────────────────────────────
// Real Dynamic Island on 14 Pro: ~126 × 37 pt
const PILL_W  = 126;
const PILL_H  = 37;
const PILL_BR = 20;

const CARD_W  = SW - 40;
const CARD_H  = 136;
const CARD_BR = 26;   // Apple uses ~26 on expanded DI

const SPRING         = { damping: 24, stiffness: 280, mass: 0.85 };
const AUTO_DISMISS_MS = 6000;

// ─── Props ────────────────────────────────────────────────────────────────────
export type DynamicIslandRPEWarningProps = {
  visible: boolean;
  rpe: number;
  isInjured: boolean;
  onInjuredChange: (val: boolean) => void;
  onDismiss: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────
export function DynamicIslandRPEWarning({
  visible,
  rpe,
  isInjured,
  onInjuredChange,
  onDismiss,
}: DynamicIslandRPEWarningProps) {
  const insets = useSafeAreaInsets();

  const width     = useSharedValue(PILL_W);
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
    width.value   = withSpring(CARD_W,  SPRING);
    height.value  = withSpring(CARD_H,  SPRING);
    radius.value  = withSpring(CARD_BR, SPRING);
    scale.value   = withSpring(1,       SPRING);
    contentOp.value = withDelay(200, withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }));
  }, [width, height, radius, scale, contentOp, triggerHaptic]);

  const collapse = useCallback(() => {
    contentOp.value = withTiming(0, { duration: 100 });
    width.value     = withDelay(80, withSpring(PILL_W,  SPRING));
    height.value    = withDelay(80, withSpring(PILL_H,  SPRING));
    radius.value    = withDelay(80, withSpring(PILL_BR, SPRING));
    scale.value     = withDelay(80, withSpring(0.88,    SPRING));
    opacity.value   = withDelay(300, withTiming(0, { duration: 180 }));
  }, [width, height, radius, opacity, contentOp, scale]);

  useEffect(() => {
    if (visible) {
      // Reset to pill first, then bloom open after a beat
      width.value     = PILL_W;
      height.value    = PILL_H;
      radius.value    = PILL_BR;
      scale.value     = 0.88;
      contentOp.value = 0;
      opacity.value   = withTiming(1, { duration: 180 });

      const expandTimer  = setTimeout(expand, 350);
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

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOp.value,
  }));

  // Pill-state icon fades out as content fades in
  const pillIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - contentOp.value,
  }));

  // Sit just inside the safe area — matches real DI placement
  const topOffset = Math.max(insets.top - 4, 6);

  return (
    <View
      style={[styles.root, { top: topOffset }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <Pressable onPress={() => { collapse(); setTimeout(onDismiss, 420); }}>
        <Animated.View style={[styles.island, containerStyle]}>

          {/* ── Pill state: tiny icon centred in the pill ── */}
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.pillCenter, pillIconStyle]}>
            <View style={styles.pillDot} />
            <Text style={styles.pillRpe}>{rpe}</Text>
          </Animated.View>

          {/* ── Expanded content ── */}
          <Animated.View style={[styles.content, contentStyle]}>

            {/* Top row: RPE badge + dismiss hint */}
            <View style={styles.row}>
              <View style={styles.rpeBadge}>
                <View style={styles.rpeDot} />
                <Text style={styles.rpeBadgeText}>RPE {rpe}</Text>
              </View>
              <Text style={styles.dismissHint}>tap to dismiss</Text>
            </View>

            {/* Message */}
            <Text style={styles.headline}>
              Aim for{' '}
              <Text style={styles.accent}>RPE 7+</Text>
              {' '}next session
            </Text>
            <Text style={styles.subtext}>
              You're leaving gains on the table. Push closer to your limit.
            </Text>

            {/* Injured toggle */}
            <View style={styles.divider} />
            <View style={styles.injuredRow}>
              <Text style={styles.injuredLabel}>Going easy (injury / recovery)</Text>
              <Switch
                value={isInjured}
                onValueChange={onInjuredChange}
                trackColor={{ false: WHITE_FAINT, true: ACCENT }}
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
    zIndex: 999,
  },

  // The island itself — pure black, no glass
  island: {
    backgroundColor: BLACK,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow so it reads against dark workout backgrounds
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 24,
  },

  // ── Pill state ──────────────────────────────────────────────────────────────
  pillCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  pillRpe: {
    fontSize: 14,
    fontWeight: '600',
    color: WHITE,
    letterSpacing: -0.2,
  },

  // ── Expanded content ────────────────────────────────────────────────────────
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
    width: '100%',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rpeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,159,10,0.15)',
  },
  rpeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  rpeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT,
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
    marginTop: 8,
  },
  accent: {
    color: ACCENT,
  },
  subtext: {
    fontSize: 12,
    fontWeight: '400',
    color: WHITE_DIM,
    letterSpacing: -0.1,
    marginTop: 3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: 10,
  },
  injuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  injuredLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: WHITE_DIM,
    letterSpacing: -0.1,
  },
});
