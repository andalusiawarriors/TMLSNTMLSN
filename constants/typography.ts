import type { TextStyle } from 'react-native';
import { Colors, Font, HeadingLetterSpacing, Typography } from './theme';

/**
 * System-default typography baseline.
 * Intentionally omits fontFamily so iOS uses SF and Android uses Roboto.
 */
export const SystemTypography = {
  base: {
    color: Colors.primaryLight,
    fontSize: Typography.body,
    fontWeight: Typography.weights.regular,
  } as TextStyle,
  variants: {
    body: {
      fontSize: Typography.body,
      fontWeight: Typography.weights.regular,
    } as TextStyle,
    bodyStrong: {
      fontSize: Typography.body,
      fontWeight: Typography.weights.semiBold,
    } as TextStyle,
    label: {
      fontSize: Typography.label,
      fontWeight: Typography.weights.medium,
      letterSpacing: -0.1,
    } as TextStyle,
    data: {
      fontSize: Typography.dataValue,
      fontWeight: Typography.weights.semiBold,
      letterSpacing: -0.2,
    } as TextStyle,
    prompt: {
      fontSize: Typography.promptText,
      fontWeight: Typography.weights.regular,
    } as TextStyle,
    h1: {
      fontSize: Typography.h1,
      fontWeight: Typography.weights.bold,
      letterSpacing: HeadingLetterSpacing,
    } as TextStyle,
    h2: {
      fontSize: Typography.h2,
      fontWeight: Typography.weights.bold,
      letterSpacing: HeadingLetterSpacing * 0.5,
    } as TextStyle,
  },
} as const;

export type TmlsnTextVariant = keyof typeof SystemTypography.variants;

/**
 * Explicit opt-in families for exceptional contexts only.
 * Do not use these for default UI text.
 */
export const TypographyFamilies = {
  brandRegular: Font.regular,
  brandMedium: Font.medium,
  brandSemiBold: Font.semiBold,
  brandBold: Font.bold,
  brandExtraBold: Font.extraBold,
  mono: Font.mono,
  monoMedium: Font.monoMedium,
} as const;

