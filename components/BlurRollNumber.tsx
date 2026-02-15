/**
 * Blur-roll number transition – Scale bloom + speed approach.
 * No Skia blur. Exit: scale up + fade. Enter: scale down + fade in + overshoot.
 * Per-character stagger for wave effect.
 */
import React, { memo, useMemo } from 'react';
import { View, Text, TextStyle, StyleProp } from 'react-native';
import Animated, {
  SharedValue,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withDelay,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

// ── Timing ──
const STAGGER_MS = 12;
const ACCEL_MS = 120;
const DECEL_MS = 480;

function lerp(
  input: number,
  inputRange: number[],
  outputRange: number[],
): number {
  'worklet';
  if (input <= inputRange[0]) return outputRange[0];
  if (input >= inputRange[inputRange.length - 1])
    return outputRange[outputRange.length - 1];
  for (let i = 0; i < inputRange.length - 1; i++) {
    if (input >= inputRange[i] && input <= inputRange[i + 1]) {
      const t =
        (input - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return outputRange[i] + t * (outputRange[i + 1] - outputRange[i]);
    }
  }
  return outputRange[outputRange.length - 1];
}

// ═══════════════════════════════════════════════
// Per-character animated layer
// ═══════════════════════════════════════════════
interface CharProps {
  char: string;
  index: number;
  layer: 'left' | 'eaten';
  isEaten: SharedValue<number>;
  trigger: SharedValue<number>;
  style: StyleProp<TextStyle>;
  height: number;
}

const BloomChar = memo<CharProps>(
  ({ char, index, layer, isEaten, trigger, style, height }) => {
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
                withTiming(0.4, {
                  duration: ACCEL_MS,
                  easing: Easing.in(Easing.cubic),
                }),
                withTiming(1, {
                  duration: DECEL_MS,
                  easing: Easing.out(Easing.cubic),
                }),
              ),
            ),
          );
        }
      },
    );

    const animStyle = useAnimatedStyle(() => {
      const p = progress.value;
      const isLeftNum = layer === 'left' ? 1 : 0;
      const isOut = isLeftNum === 1 ? isEaten.value : 1 - isEaten.value;

      // ── Outgoing: scale up, drop down, fade out fast ──
      const outScale = lerp(p, [0, 0.15, 0.35], [1, 1.18, 1.3]);
      const outY = lerp(p, [0, 0.35], [0, height * 0.3]);
      const outOp = lerp(p, [0, 0.08, 0.25], [1, 0.4, 0]);

      // ── Incoming: start small + above, drop with overshoot, scale to 1 ──
      const inScale = lerp(
        p,
        [0.2, 0.6, 0.75, 0.88, 1],
        [0.82, 1.03, 0.985, 1.005, 1],
      );
      const inY = lerp(
        p,
        [0.2, 0.6, 0.75, 0.88, 1],
        [-height * 0.5, height * 0.04, -height * 0.018, height * 0.005, 0],
      );
      const inOp = lerp(p, [0.2, 0.4], [0, 1]);

      const scale = outScale * isOut + inScale * (1 - isOut);
      const translateY = outY * isOut + inY * (1 - isOut);
      const opacity = outOp * isOut + inOp * (1 - isOut);

      return {
        transform: [{ translateY }, { scale }],
        opacity,
      };
    });

    return (
      <Animated.View style={animStyle}>
        <Text style={style}>{char}</Text>
      </Animated.View>
    );
  },
);

BloomChar.displayName = 'BloomChar';

// ═══════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════
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
  leftValue,
  eatenValue,
  eatenSuffix,
  isEaten,
  trigger,
  textStyle,
  suffixStyle,
  height,
}) => {
  const leftChars = leftValue.split('');
  const eatenMainChars = eatenValue.split('');
  const suffChars = eatenSuffix ? eatenSuffix.split('') : [];

  return (
    <View style={{ height, overflow: 'visible' }}>
      {/* Left value */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {leftChars.map((c, i) => (
          <BloomChar
            key={'l' + i}
            char={c}
            index={i}
            layer="left"
            isEaten={isEaten}
            trigger={trigger}
            style={textStyle}
            height={height}
          />
        ))}
      </View>
      {/* Eaten value */}
      <View
        style={{
          flexDirection: 'row',
          position: 'absolute',
          top: 0,
          left: 0,
          alignItems: 'baseline',
        }}
      >
        {eatenMainChars.map((c, i) => (
          <BloomChar
            key={'e' + i}
            char={c}
            index={i}
            layer="eaten"
            isEaten={isEaten}
            trigger={trigger}
            style={textStyle}
            height={height}
          />
        ))}
        {suffChars.map((c, i) => (
          <BloomChar
            key={'s' + i}
            char={c}
            index={eatenMainChars.length + i}
            layer="eaten"
            isEaten={isEaten}
            trigger={trigger}
            style={suffixStyle || textStyle}
            height={height}
          />
        ))}
      </View>
    </View>
  );
};
