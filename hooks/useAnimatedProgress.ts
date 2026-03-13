import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly interpolates a numeric value toward a target using
 * requestAnimationFrame with easeOutCubic easing.
 * Returns the current interpolated value (triggers React re-renders during animation).
 */
export function useAnimatedProgress(target: number, duration = 600): number {
  const [current, setCurrent] = useState(target);
  const currentRef = useRef(target);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const from = currentRef.current;
    if (Math.abs(from - target) < 0.001 || duration === 0) {
      currentRef.current = target;
      setCurrent(target);
      return;
    }
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const val = from + (target - from) * eased;
      currentRef.current = val;
      setCurrent(val);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return current;
}
