/**
 * AddFoodCard — Pill button per Figma: 140×48, radius 28, fill #2F3031 25%, stroke #FFF 25% 1px.
 * Label: SF Pro Semibold 14, line height 118.7%, letter spacing -5%, #FFFFFF.
 * Plus: 18.75×18.75, #C6C6C6, 1px stroke #C6C6C6.
 * Haptics match FAB: Light on press in, Medium on press out.
 */
import React, { useCallback, useRef } from 'react';
import { Text, StyleSheet, Pressable, Animated, View } from 'react-native';
import { Plus } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';

const PILL_WIDTH = 140;
const PILL_HEIGHT = 48;
const PILL_RADIUS = 28;
const PLUS_SIZE = 18.75;
const LABEL_FONT_SIZE = 14;
const LABEL_LINE_HEIGHT = LABEL_FONT_SIZE * 1.187; // 118.7%
const LABEL_LETTER_SPACING = -0.05 * LABEL_FONT_SIZE; // -5%

export type AddFoodCardProps = {
  onPress: () => void;
};

export function AddFoodCard({ onPress }: AddFoodCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.timing(scaleAnim, { toValue: 1.03, duration: 260, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(scaleAnim, { toValue: 1, duration: 55, useNativeDriver: true }).start();
    onPress();
  }, [scaleAnim, onPress]);

  return (
    <Pressable onPressIn={handlePressIn} onPress={handlePress} style={styles.pressable}>
      <Animated.View style={[styles.btn, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.plusWrap}>
          <Plus size={PLUS_SIZE} color="#C6C6C6" weight="bold" />
        </View>
        <Text style={styles.label}>add a food</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignSelf: 'center' },
  btn: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(47, 48, 49, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  plusWrap: {
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    lineHeight: LABEL_LINE_HEIGHT,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: LABEL_LETTER_SPACING,
  },
});

export default AddFoodCard;
