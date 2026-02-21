import React from 'react';
import { TextInput, Text, View, StyleSheet, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { Colors, Typography, BorderRadius, Spacing } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  fontFamily?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  fontFamily,
  ...props
}) => {
  const { colors } = useTheme();
  const labelStyle = fontFamily ? [styles.label, { fontFamily, color: colors.primaryLight }] : [styles.label, { color: colors.primaryLight }];
  const inputStyle = fontFamily
    ? [styles.input, { fontFamily }, { backgroundColor: colors.primaryDarkLighter, borderColor: colors.primaryLight, color: colors.primaryLight }, error && styles.inputError, style]
    : [styles.input, { backgroundColor: colors.primaryDarkLighter, borderColor: colors.primaryLight, color: colors.primaryLight }, error && styles.inputError, style];
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={labelStyle}>{label}</Text>}
      <TextInput
        style={inputStyle}
        placeholderTextColor={colors.primaryLight + '99'}
        {...props}
      />
      {error && <Text style={[styles.error, fontFamily && { fontFamily }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.label,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
    fontWeight: Typography.weights.medium,
  },
  input: {
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: Typography.body,
    color: Colors.white,
    minHeight: 48,
  },
  inputError: {
    borderColor: Colors.accentRed,
  },
  error: {
    fontSize: Typography.label,
    color: Colors.accentRed,
    marginTop: Spacing.xs,
  },
});
