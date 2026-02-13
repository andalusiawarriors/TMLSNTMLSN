/**
 * Blur-roll number transition (flywheel) on card tap.
 * - Acceleration: digit scrolls up, cubic ease-in, motion blur via stacked semi-transparent copies.
 * - Deceleration: spring snap with slight overshoot (≤600ms per digit).
 * - Stagger: 70ms left-to-right per digit. Labels: 150ms crossfade.
 * - Toggle: same upward roll both directions. Reanimated only; no native blur filter.
 */
import React, { memo } from 'react';
import { View, Text, TextStyle, StyleProp } from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withDelay,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  Easing,
  Extrapolation,
  cancelAnimation,
} from 'react-native-reanimated';

const STAGGER_MS = 29;   // 20% faster again (was 36)
const ACCEL_MS = 102;    // 20% faster again (was 128)
const SPRING_CFG = { damping: 14, stiffness: 390, mass: 0.26 }; // ~20% faster spring
// Per-digit fade in/out during motion; at animation end revert to full opacity (#FFF)
const FADE_IN_END = 0.07;
const FADE_OUT_START = 0.93;
const FADE_EDGE_OPACITY = 0.5; // opacity at start/end of motion (during animation only)
// Soft fog + glow (no directional streak): radial copies around digit, visible only while moving
const FOG_RADIUS = 3; // px – inner soft diffusion (~33% larger)
const FOG_OPACITY = 0.43;
const GLOW_RADIUS = 7; // px – outer halo (~33% larger)
const GLOW_OPACITY = 0.24;
const NUM_RADIAL = 8; // 8 directions for even fog/glow

interface CharProps {
  char: string;
  index: number;
  layer: 'left' | 'eaten';
  isEaten: SharedValue<number>;
  trigger: SharedValue<number>;
  style: StyleProp<TextStyle>;
  height: number;
}

const BlurRollChar = memo<CharProps>(({
  char, index, layer, isEaten, trigger, style, height,
}) => {
  const progress = useSharedValue(1);

  useAnimatedReaction(
    () => trigger.value,
    (curr, prev) => {
      if (prev !== null && prev !== undefined && curr !== prev) {
        cancelAnimation(progress);
        progress.value = withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(
            index * STAGGER_MS,
            withSequence(
              withTiming(0.5, {
                duration: ACCEL_MS,
                easing: Easing.in(Easing.cubic),
              }),
              withSpring(1, SPRING_CFG),
            ),
          ),
        );
      }
    },
  );

  const wrapStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const isLeft = layer === 'left' ? 1 : 0;
    const isOut = isLeft === 1 ? isEaten.value : 1 - isEaten.value;
    const outY = interpolate(p, [0, 0.5], [0, height * 1.3], Extrapolation.CLAMP);
    const outOp = interpolate(p, [0, 0.3, 0.5], [1, 0.38, 0], Extrapolation.CLAMP);
    const inY = interpolate(p, [0.3, 1], [-height * 1.3, 0], Extrapolation.CLAMP);
    const inOp = interpolate(p, [0.3, 0.5, 0.85], [0, 0.38, 1], Extrapolation.CLAMP);
    const baseOp = outOp * isOut + inOp * (1 - isOut);
    const fadeIn = interpolate(p, [0, FADE_IN_END], [FADE_EDGE_OPACITY, 1], Extrapolation.CLAMP);
    const fadeOut = interpolate(p, [FADE_OUT_START, 1], [1, FADE_EDGE_OPACITY], Extrapolation.CLAMP);
    const staggerFade = fadeIn * fadeOut;
    // During motion use stagger fade; from FADE_OUT_START→1 gradually restore to 1 so rest state is full #FFF
    const restoreToFull = interpolate(p, [FADE_OUT_START, 1], [staggerFade, 1], Extrapolation.CLAMP);
    const opacityMul = p >= FADE_OUT_START ? restoreToFull : (staggerFade < 1 ? staggerFade : 1);
    return {
      transform: [{ translateY: outY * isOut + inY * (1 - isOut) }],
      opacity: baseOp * opacityMul,
    };
  });

  const ghostStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const isLeft = layer === 'left' ? 1 : 0;
    const isOut = isLeft === 1 ? isEaten.value : 1 - isEaten.value;
    const outB = interpolate(p, [0, 0.08, 0.25, 0.5], [0, 0.78, 1, 0.28], Extrapolation.CLAMP);
    const inB = interpolate(p, [0.28, 0.5, 0.7, 0.92], [0.28, 1, 0.78, 0], Extrapolation.CLAMP);
    const baseB = outB * isOut + inB * (1 - isOut);
    const fadeIn = interpolate(p, [0, FADE_IN_END], [FADE_EDGE_OPACITY, 1], Extrapolation.CLAMP);
    const fadeOut = interpolate(p, [FADE_OUT_START, 1], [1, FADE_EDGE_OPACITY], Extrapolation.CLAMP);
    return { opacity: baseB * fadeIn * fadeOut };
  });

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={wrapStyle}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, ghostStyle]} pointerEvents="none">
          {Array.from({ length: NUM_RADIAL }, (_, i) => {
            const a = (i / NUM_RADIAL) * 2 * Math.PI;
            const fogX = FOG_RADIUS * Math.cos(a);
            const fogY = FOG_RADIUS * Math.sin(a);
            const glowX = GLOW_RADIUS * Math.cos(a);
            const glowY = GLOW_RADIUS * Math.sin(a);
            return (
              <React.Fragment key={i}>
                <Text style={[style as TextStyle, { position: 'absolute', left: fogX, top: fogY, opacity: FOG_OPACITY }]}>{char}</Text>
                <Text style={[style as TextStyle, { position: 'absolute', left: glowX, top: glowY, opacity: GLOW_OPACITY }]}>{char}</Text>
              </React.Fragment>
            );
          })}
        </Animated.View>
        <Text style={style as TextStyle}>{char}</Text>
      </Animated.View>
    </View>
  );
});

BlurRollChar.displayName = 'BlurRollChar';

interface Props {
  leftValue: string;
  eatenValue: string;
  eatenSuffix?: string;
  isEaten: SharedValue<number>;
  trigger: SharedValue<number>;
  textStyle: StyleProp<TextStyle>;
  suffixStyle?: StyleProp<TextStyle>;
  height: number;
}

export const BlurRollNumber: React.FC<Props> = ({
  leftValue, eatenValue, eatenSuffix,
  isEaten, trigger, textStyle, suffixStyle, height,
}) => {
  const leftChars = leftValue.split('');
  const eatenMainChars = eatenValue.split('');
  const suffChars = eatenSuffix ? eatenSuffix.split('') : [];

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        {leftChars.map((c, i) => (
          <BlurRollChar key={'l' + i} char={c} index={i} layer="left"
            isEaten={isEaten} trigger={trigger} style={textStyle} height={height} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', position: 'absolute', top: 0, left: 0 }}>
        {eatenMainChars.map((c, i) => (
          <BlurRollChar key={'e' + i} char={c} index={i} layer="eaten"
            isEaten={isEaten} trigger={trigger} style={textStyle} height={height} />
        ))}
        {suffChars.map((c, i) => (
          <BlurRollChar key={'s' + i} char={c} index={eatenMainChars.length + i} layer="eaten"
            isEaten={isEaten} trigger={trigger} style={suffixStyle || textStyle} height={height} />
        ))}
      </View>
    </View>
  );
};
