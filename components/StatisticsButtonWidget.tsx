// ============================================================
// TMLSN — Statistics button widget (pressable, navigates to full stats)
// Same style as streak/achievements cards
// ============================================================

import React from 'react';
import { Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useButtonSound } from '../hooks/useButtonSound';
import { AnimatedPressable } from './AnimatedPressable';
import { Colors, Shadows } from '../constants/theme';

const PROGRESS_CARD_WIDTH = Math.min(380, Dimensions.get('window').width - 40);
const PROGRESS_CARD_HEIGHT = 237;

export function StatisticsButtonWidget() {
  const router = useRouter();
  const { playIn, playOut } = useButtonSound();

  return (
      <AnimatedPressable
        onPressIn={playIn}
        onPressOut={playOut}
        onPress={() => router.push('/workout/statistics')}
        style={styles.card}
      >
        <Text style={styles.cardText}>statistics</Text>
      </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    borderRadius: 38,
    alignSelf: 'center',
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  cardText: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: 0,
    color: '#C6C6C6',
    textAlign: 'center',
  },
});
