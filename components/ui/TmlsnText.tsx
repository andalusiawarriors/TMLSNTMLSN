import React from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { SystemTypography, type TmlsnTextVariant } from '../../constants/typography';

type Props = TextProps & {
  variant?: TmlsnTextVariant;
  color?: string;
  /**
   * Explicit opt-in override for exceptional contexts only.
   * Leave undefined to use system-default platform font.
   */
  fontFamily?: string;
  style?: StyleProp<TextStyle>;
};

export function TmlsnText({
  variant = 'body',
  color,
  fontFamily,
  style,
  children,
  ...rest
}: Props) {
  return (
    <Text
      {...rest}
      style={[
        SystemTypography.base,
        SystemTypography.variants[variant],
        color ? { color } : null,
        fontFamily ? { fontFamily } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

