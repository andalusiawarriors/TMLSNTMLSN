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

const STAGGER_MS = 70;
const ACCEL_MS = 250;
const SPRING_CFG = { damping: 14, stiffness: 160, mass: 0.6 };
const NUM_GHOST_PAIRS = 2;
const GHOST_OP_BASE = 0.45;
const GHOST_OP_DECAY = 0.18;

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

  const ghostSpread = Math.max(3, Math.round(height * 0.18));

  const wrapStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const isLeft = layer === 'left' ? 1 : 0;
    const isOut = isLeft === 1 ? isEaten.value : 1 - isEaten.value;
    const outY = interpolate(p, [0, 0.5], [0, -height * 1.3], Extrapolation.CLAMP);
    const outOp = interpolate(p, [0, 0.3, 0.5], [1, 0.6, 0], Extrapolation.CLAMP);
    const inY = interpolate(p, [0.3, 1], [height * 1.3, 0], Extrapolation.CLAMP);
    const inOp = interpolate(p, [0.3, 0.5, 0.85], [0, 0.6, 1], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: outY * isOut + inY * (1 - isOut) }],
      opacity: outOp * isOut + inOp * (1 - isOut),
    };
  });

  const ghostStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const isLeft = layer === 'left' ? 1 : 0;
    const isOut = isLeft === 1 ? isEaten.value : 1 - isEaten.value;
    const outB = interpolate(p, [0, 0.12, 0.3, 0.5], [0, 0.6, 1, 0.2], Extrapolation.CLAMP);
    const inB = interpolate(p, [0.3, 0.5, 0.72, 0.9], [0.2, 1, 0.6, 0], Extrapolation.CLAMP);
    return { opacity: outB * isOut + inB * (1 - isOut) };
  });

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={wrapStyle}>
        <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, ghostStyle]}>
          {Array.from({ length: NUM_GHOST_PAIRS }).map((_, gi) => {
            const off = (gi + 1) * ghostSpread;
            const gOp = GHOST_OP_BASE - gi * GHOST_OP_DECAY;
            return (
              <React.Fragment key={gi}>
                <Text style={[style as TextStyle, { position: 'absolute', top: -off, opacity: gOp }]}>{char}</Text>
                <Text style={[style as TextStyle, { position: 'absolute', top: off, opacity: gOp }]}>{char}</Text>
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
