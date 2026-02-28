import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, BorderRadius, Spacing } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'gradient';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryButton;
      case 'secondary':
        return styles.secondaryButton;
      case 'danger':
        return styles.dangerButton;
      case 'gradient':
        return styles.gradientButton;
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
        return styles.primaryText;
      case 'secondary':
        return styles.secondaryText;
      case 'danger':
        return styles.dangerText;
      case 'gradient':
        return styles.gradientText;
      default:
        return styles.primaryText;
    }
  };

  const isGradient = variant === 'gradient';

  const content = loading ? (
    <ActivityIndicator color={variant === 'secondary' || isGradient ? Colors.primaryLight : Colors.white} />
  ) : (
    <Text style={[styles.text, getTextStyle(), textStyle]}>{title}</Text>
  );

  if (isGradient) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.gradientButtonOuter, disabled && styles.disabled, style]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={Colors.tabBarBorder as [string, string]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.gradientButtonInner, { backgroundColor: Colors.tabBarFill[1] }]}>
          {content}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButton: {
    backgroundColor: Colors.accentBlue,
  },
  gradientButtonOuter: {
    overflow: 'hidden',
  },
  gradientButton: {
    backgroundColor: 'transparent',
  },
  gradientButtonInner: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: BorderRadius.md - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientText: {
    color: Colors.primaryLight,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  dangerButton: {
    backgroundColor: Colors.accentRed,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: Typography.body,
    fontWeight: Typography.weights.semiBold,
  },
  primaryText: {
    color: Colors.white,
  },
  secondaryText: {
    color: Colors.primaryLight,
  },
  dangerText: {
    color: Colors.white,
  },
});
