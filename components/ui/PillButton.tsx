import React from 'react';
import { Pressable, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const PILL_HEIGHT = 44;
const PILL_RADIUS = 38;
const PADDING_H = 18;
const OUTLINE_BORDER = 'rgba(198,198,198,0.18)';
const OUTLINE_FILL = 'rgba(198,198,198,0.06)';
const PRIMARY_BG = '#C6C6C6';
const PRIMARY_TEXT = '#2F3032';
const DISABLED_OPACITY = 0.55;

export type PillButtonVariant = 'primary' | 'outline' | 'ghost';

type PillButtonProps = {
  variant?: PillButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function PillButton({
  variant = 'outline',
  onPress,
  disabled = false,
  loading = false,
  label,
  leftIcon,
  style,
  textStyle,
}: PillButtonProps) {
  const { colors } = useTheme();

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    const base: ViewStyle = {
      height: PILL_HEIGHT,
      borderRadius: PILL_RADIUS,
      paddingHorizontal: PADDING_H,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      opacity: disabled ? DISABLED_OPACITY : 1,
      transform: [{ scale: pressed && !disabled ? 0.99 : 1 }],
    };

    switch (variant) {
      case 'primary':
        return {
          ...base,
          backgroundColor: PRIMARY_BG,
        };
      case 'outline':
        return {
          ...base,
          backgroundColor: OUTLINE_FILL,
          borderWidth: 1,
          borderColor: OUTLINE_BORDER,
        };
      case 'ghost':
        return {
          ...base,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: OUTLINE_BORDER,
        };
      default:
        return base;
    }
  };

  const getTextStyle = (): TextStyle => {
    const base: TextStyle = {
      fontSize: 14,
      fontWeight: '600',
      letterSpacing: -0.11,
    };
    if (variant === 'primary') {
      return { ...base, color: PRIMARY_TEXT };
    }
    return { ...base, color: colors.primaryLight };
  };

  const spinnerColor = variant === 'primary' ? PRIMARY_TEXT : colors.primaryLight;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [getContainerStyle(pressed), style]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {leftIcon}
          <Text style={[getTextStyle(), textStyle]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
