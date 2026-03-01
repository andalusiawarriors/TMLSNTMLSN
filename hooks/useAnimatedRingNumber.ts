import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

/** Animated number with ascending transition + haptic when target changes (matches original calorie ring) */
export function useAnimatedRingNumber(target: number, duration = 500): number {
  const [display, setDisplay] = useState(target);
  const current = useRef(target);
  const prevTarget = useRef(target);
  useEffect(() => {
    const from = current.current;
    if (prevTarget.current !== target) {
      prevTarget.current = target;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (target - from) * ease);
      setDisplay(val);
      current.current = val;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return display;
}
