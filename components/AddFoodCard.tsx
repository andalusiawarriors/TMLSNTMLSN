/**
 * AddFoodCard — Pill button, white, 321×55.
 * Tapping morphs into the bottom card of the deck.
 * Haptics match FAB: Light on press in, Medium on press out.
 */
import React, { useCallback, useRef } from 'react';
import { Text, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { Plus } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';

const PILL_MARGIN_H = 19;
const BTN_WIDTH = Dimensions.get('window').width - 2 * PILL_MARGIN_H;
const BTN_HEIGHT = 55;
const BTN_RADIUS = BTN_HEIGHT / 2;

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
        <Plus size={18} color="#000000" weight="bold" />
        <Text style={styles.label}>add food</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { alignSelf: 'center' },
  btn: {
    width: BTN_WIDTH,
    height: BTN_HEIGHT,
    borderRadius: BTN_RADIUS,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: -0.2,
  },
});

export default AddFoodCard;
