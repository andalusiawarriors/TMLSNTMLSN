import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, Spacing, Shadows } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
const CARD_BORDER_INSET = 1;
const CARD_BORDER_RADIUS = BorderRadius.lg; // 16, matches nutrition cards

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When true, uses bottom-pill-style border + gradient fill (no spacing/centering change) */
  gradientFill?: boolean;
  /** Override border radius when gradientFill (e.g. 38 for workout cards) */
  borderRadius?: number;
}

export const Card: React.FC<CardProps> = ({ children, style, gradientFill, borderRadius: radiusOverride }) => {
  const { colors } = useTheme();
  const cardStyle = [styles.card, style];
  const radius = radiusOverride ?? CARD_BORDER_RADIUS;
  if (gradientFill) {
    return (
      <View
        style={[
          cardStyle,
          {
            backgroundColor: 'transparent',
            overflow: 'hidden',
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 2,
            elevation: 1,
          },
        ]}
      >
        {/* Border gradient (subtle top-to-bottom, like bottom pill) */}
        <LinearGradient
          colors={colors.cardBorderGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        />
        {/* Fill gradient (inset 1px) */}
        <LinearGradient
          colors={colors.cardFillGradient}
          style={{
            position: 'absolute',
            top: CARD_BORDER_INSET,
            left: CARD_BORDER_INSET,
            right: CARD_BORDER_INSET,
            bottom: CARD_BORDER_INSET,
            borderRadius: radius - CARD_BORDER_INSET,
          }}
        />
        {children}
      </View>
    );
  }
  return <View style={[cardStyle, { backgroundColor: colors.primaryDark }]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginVertical: Spacing.sm,
    ...Shadows.card,
  },
});
