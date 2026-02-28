import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Card } from '../Card';
import { AnimatedPressable } from '../AnimatedPressable';
import { Typography, Spacing } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PROGRESS_CARD_WIDTH = Math.min(380, SCREEN_WIDTH - 40);
const PROGRESS_CARD_HEIGHT = 237;
const MAIN_MENU_BUTTON_GAP = 15;

/**
 * Extracted achievements card for reuse (e.g. profile or another screen).
 * No longer shown on the Explore tab.
 */
export function AchievementsCard() {
  const { colors } = useTheme();

  return (
    <View style={styles.achievementsStack}>
      <AnimatedPressable style={styles.achievementCardWrap}>
        <Card gradientFill borderRadius={38} style={styles.achievementCard}>
          <Text style={[styles.achievementCardText, { color: colors.cardIconTint }]}>
            achievements
          </Text>
        </Card>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  achievementsStack: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: MAIN_MENU_BUTTON_GAP,
    marginBottom: Spacing.sm,
  },
  achievementCardWrap: {
    alignSelf: 'center',
  },
  achievementCard: {
    width: PROGRESS_CARD_WIDTH,
    height: PROGRESS_CARD_HEIGHT,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    marginVertical: 0,
  },
  achievementCardText: {
    fontSize: Typography.promptText,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: -0.11,
    textAlign: 'center',
  },
});
