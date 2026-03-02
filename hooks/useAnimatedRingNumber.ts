import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

export type RingNumberEasing = 'easeOut' | 'easeInOut';
export type RingNumberHaptic = 'none' | 'single' | 'sequence';

const MS_PER_FRAME = 8;
const MAX_DURATION_MS = 500;

// Shared throttle across all hook instances (only the calories hook should use
// 'sequence'; others should pass 'none' so there's no contention).
const MIN_GAP_MS = 20;
const MAX_GAP_MS = 50;
let lastSequenceHapticMs = 0;

// Range thresholds for scaling haptic intensity
const TINY_RANGE = 10;
const SMALL_RANGE = 50;

function throttledSequenceHaptic(t: number) {
  const now = Date.now();
  const gap = MIN_GAP_MS + t * (MAX_GAP_MS - MIN_GAP_MS);
  if (now - lastSequenceHapticMs >= gap) {
    lastSequenceHapticMs = now;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

export function useAnimatedRingNumber(
  target: number,
  duration = 500,
  options?: { easing?: RingNumberEasing; haptic?: RingNumberHaptic }
): number {
  const { easing = 'easeOut', haptic = 'single' } = options ?? {};
  const [display, setDisplay] = useState(target);
  const current = useRef(target);
  const prevTarget = useRef(target);
  useEffect(() => {
    const from = current.current;
    const range = Math.abs(target - from);
    if (range === 0) {
      prevTarget.current = target;
      setDisplay(target);
      current.current = target;
      return;
    }

    const isTiny = range < TINY_RANGE;
    const isSmall = range < SMALL_RANGE;

    if (prevTarget.current !== target) {
      prevTarget.current = target;
      if (haptic === 'single') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (haptic === 'sequence') {
        if (isTiny) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          throttledSequenceHaptic(0);
        }
      }
    }
    const effectiveDuration = Math.min(
      Math.max(duration, range * MS_PER_FRAME),
      MAX_DURATION_MS
    );
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / effectiveDuration, 1);
      const ease =
        easing === 'easeInOut'
          ? t * t * (3 - 2 * t)
          : 1 - Math.pow(1 - t, 3);
      const desired = from + (target - from) * ease;
      const rounded = Math.round(desired);
      const val =
        target >= from
          ? Math.min(target, Math.max(from, rounded))
          : Math.max(target, Math.min(from, rounded));
      setDisplay(val);
      current.current = val;
      if (haptic === 'sequence' && !isTiny) {
        if (isSmall) {
          if (t < 0.5) throttledSequenceHaptic(t);
        } else {
          throttledSequenceHaptic(t);
        }
      }
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, easing, haptic]);
  return display;
}
