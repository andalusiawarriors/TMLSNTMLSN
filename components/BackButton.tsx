import React from 'react';
import { View, Pressable, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'phosphor-react-native';
import { Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const CONTENT_PADDING = 19;
const TOP_LEFT_PILL_TOP = 54;

function getCalorieCardLeft(): number {
  const width = Dimensions.get('window').width;
  const CAROUSEL_WIDTH = width - CONTENT_PADDING * 2;
  const WEEK_STRIP_HPAD = Spacing.sm;
  const DAY_CARD_WIDTH = 50;
  const DAY_COL_WIDTH = (CAROUSEL_WIDTH - 2 * WEEK_STRIP_HPAD) / 7;
  const CALORIES_CARD_WIDTH = Math.round(6 * DAY_COL_WIDTH + DAY_CARD_WIDTH);
  return CONTENT_PADDING + (CAROUSEL_WIDTH - CALORIES_CARD_WIDTH) / 2;
}

const SIZE = 40;
const BORDER_RADIUS = 20;
const INNER_RADIUS = 19;

type BackButtonProps = {
  onPress?: () => void;
  style?: ViewStyle;
};

export function BackButton({ onPress, style }: BackButtonProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  const handlePressIn = () => {
    scale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const left = getCalorieCardLeft();
  const containerStyle = [styles.container, { top: TOP_LEFT_PILL_TOP, left }, style];

  return (
    <Pressable
      style={containerStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <Animated.View style={[styles.outer, animatedStyle]}>
        <View style={styles.pill}>
          <LinearGradient
            colors={colors.pillBorderGradient}
            style={styles.borderGradient}
          />
          <LinearGradient
            colors={colors.pillFillGradient}
            style={styles.fillGradient}
          />
          <View style={styles.iconWrap}>
            <ArrowLeft size={20} color={colors.cardIconTint} weight="regular" />
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    zIndex: 10,
  },
  outer: {
    width: SIZE,
    height: SIZE,
  },
  pill: {
    width: SIZE,
    height: SIZE,
    borderRadius: BORDER_RADIUS,
    overflow: 'hidden',
  },
  borderGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BORDER_RADIUS,
  },
  fillGradient: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: INNER_RADIUS,
  },
  iconWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
