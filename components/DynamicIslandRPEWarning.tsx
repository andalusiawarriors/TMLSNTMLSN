/**
 * DynamicIslandRPEWarning
 *
 * Mimics the Dynamic Island expanding from the top of the screen.
 * Triggered when the user logs RPE below 7 after a set/session.
 *
 * On iPhone 14 Pro+: the pill sits exactly over the Dynamic Island.
 * On all other devices: it appears as a floating pill at the top.
 *
 * Design: glass morphism (matches workout-logged.tsx / TodaysSessionCarousel.tsx).
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
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens (matches app design system) ────────────────────────────────
const C_TEXT     = '#edf0f2';
const C_DIM      = 'rgba(198,198,198,0.55)';
const C_AMBER    = '#FFB340';   // warning yellow-amber
const C_AMBER_BG = 'rgba(255,179,64,0.12)';
const C_AMBER_BD = 'rgba(255,179,64,0.30)';

// Pill dimensions (matches real Dynamic Island proportions)
const PILL_W     = 126;
const PILL_H     = 37;
const PILL_BR    = 20;

// Expanded card dimensions
const CARD_W     = SW - 32;
const CARD_H     = 148;
const CARD_BR    = 28;

const SPRING = { damping: 22, stiffness: 260, mass: 0.9 };
const AUTO_DISMISS_MS = 5000;

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

  // Animated values
  const width      = useSharedValue(PILL_W);
  const height     = useSharedValue(PILL_H);
  const radius     = useSharedValue(PILL_BR);
  const opacity    = useSharedValue(0);
  const contentOp  = useSharedValue(0);
  const scale      = useSharedValue(0.85);

  const triggerHaptic = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const expand = useCallback(() => {
    runOnJS(triggerHaptic)();

    // Container expands from pill → card
    width.value   = withSpring(CARD_W,  SPRING);
    height.value  = withSpring(CARD_H,  SPRING);
    radius.value  = withSpring(CARD_BR, SPRING);
    opacity.value = withSpring(1,        SPRING);
    scale.value   = withSpring(1,        SPRING);

    // Content fades in after expansion settles
    contentOp.value = withDelay(180, withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) }));
  }, [width, height, radius, opacity, contentOp, scale, triggerHaptic]);

  const collapse = useCallback(() => {
    contentOp.value = withTiming(0, { duration: 120 });
    width.value     = withDelay(80, withSpring(PILL_W, SPRING));
    height.value    = withDelay(80, withSpring(PILL_H, SPRING));
    radius.value    = withDelay(80, withSpring(PILL_BR, SPRING));
    opacity.value   = withDelay(260, withTiming(0, { duration: 160 }));
    scale.value     = withDelay(80, withSpring(0.88, SPRING));
  }, [width, height, radius, opacity, contentOp, scale]);

  useEffect(() => {
    if (visible) {
      // Brief pause so the user sees the pill first, then it blooms open
      opacity.value = withTiming(1, { duration: 200 });
      scale.value   = 1;
      width.value   = PILL_W;
      height.value  = PILL_H;
      radius.value  = PILL_BR;
      contentOp.value = 0;

      const t = setTimeout(expand, 320);
      const dismiss = setTimeout(() => {
        collapse();
        setTimeout(onDismiss, 500);
      }, AUTO_DISMISS_MS);

      return () => { clearTimeout(t); clearTimeout(dismiss); };
    } else {
      collapse();
    }
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

  // Pill-state icon (visible before expansion)
  const pillIconStyle = useAnimatedStyle(() => ({
    opacity: 1 - contentOp.value,
  }));

  // Top offset: sit just inside/over the Dynamic Island / status bar area
  const topOffset = Math.max(insets.top - 6, 8);

  return (
    <View
      style={[styles.root, { top: topOffset }]}
      pointerEvents={visible ? 'box-none' : 'none'}
    >
      <Pressable onPress={() => { collapse(); setTimeout(onDismiss, 420); }}>
        <Animated.View style={[styles.container, containerStyle]}>
          {/* Glass layers */}
          <BlurView
            intensity={40}
            tint="dark"
            style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_BR }]}
          />
          <View style={[StyleSheet.absoluteFillObject, styles.fillOverlay]} />
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 0.85 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_BR }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.18 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_BR }]}
            pointerEvents="none"
          />
          {/* Amber accent rim at top */}
          <LinearGradient
            colors={['rgba(255,179,64,0.35)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.12 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_BR }]}
            pointerEvents="none"
          />
          <View
            style={[StyleSheet.absoluteFillObject, styles.border]}
            pointerEvents="none"
          />

          {/* ── Pill icon (visible while collapsed) ── */}
          <Animated.View style={[StyleSheet.absoluteFillObject, styles.pillIcon, pillIconStyle]}>
            <Text style={styles.pillEmoji}>⚡</Text>
          </Animated.View>

          {/* ── Expanded content ── */}
          <Animated.View style={[styles.content, contentStyle]}>
            {/* Header row */}
            <View style={styles.headerRow}>
              <View style={styles.rpeTag}>
                <Text style={styles.rpeTagText}>RPE {rpe}</Text>
              </View>
              <Text style={styles.dismiss}>tap to dismiss</Text>
            </View>

            {/* Warning message */}
            <Text style={styles.message}>
              Try to reach{' '}
              <Text style={styles.accentText}>RPE 7 or higher</Text>
              {' '}— you're leaving progress on the table.
            </Text>

            {/* Injured toggle */}
            <View style={styles.injuredRow}>
              <Text style={styles.injuredLabel}>I'm injured</Text>
              <Switch
                value={isInjured}
                onValueChange={onInjuredChange}
                trackColor={{ false: 'rgba(198,198,198,0.20)', true: C_AMBER }}
                thumbColor={C_TEXT}
                ios_backgroundColor="rgba(198,198,198,0.20)"
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
  container: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillOverlay: {
    backgroundColor: 'rgba(28,28,30,0.82)',
    borderRadius: CARD_BR,
  },
  border: {
    borderRadius: CARD_BR,
    borderWidth: 1,
    borderColor: C_AMBER_BD,
  },

  // Collapsed pill state
  pillIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillEmoji: {
    fontSize: 17,
  },

  // Expanded content
  content: {
    flex: 1,
    padding: 16,
    width: '100%',
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rpeTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C_AMBER_BG,
    borderWidth: 1,
    borderColor: C_AMBER_BD,
  },
  rpeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: C_AMBER,
    letterSpacing: 0.2,
  },
  dismiss: {
    fontSize: 11,
    fontWeight: '500',
    color: C_DIM,
    letterSpacing: 0.1,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: C_TEXT,
    lineHeight: 20,
    letterSpacing: -0.1,
    flex: 1,
  },
  accentText: {
    color: C_AMBER,
    fontWeight: '600',
  },
  injuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(198,198,198,0.12)',
  },
  injuredLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: C_DIM,
    letterSpacing: -0.1,
  },
});
