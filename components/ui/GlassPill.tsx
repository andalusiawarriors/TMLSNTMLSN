import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Glass } from '../../constants/theme';

interface GlassPillProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  size?: 'default' | 'small';
  haptic?: 'light' | 'medium' | 'none';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function GlassPill({
  label,
  onPress,
  selected = false,
  disabled = false,
  loading = false,
  leftIcon,
  size = 'default',
  haptic = 'light',
  style,
  textStyle,
}: GlassPillProps) {
  const isSmall = size === 'small';
  const height = isSmall ? 32 : 44;
  const paddingH = isSmall ? 14 : 20;
  const fontSize = isSmall ? 12 : 14;

  const handlePress = useCallback(() => {
    if (haptic === 'light') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (haptic === 'medium') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress();
  }, [haptic, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: paddingH,
          backgroundColor: pressed
            ? Glass.fillPressed
            : selected
              ? Glass.fillSelected
              : Glass.fill,
          borderColor: selected ? Glass.borderSelected : Glass.border,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed && !disabled ? 0.96 : 1 }],
        },
        style,
      ]}
    >
      {/* Glass prominent specular — appears on selected state */}
      {selected && (
        <LinearGradient
          colors={[Glass.specularStrong, 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.7 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: Glass.radius.primary }]}
          pointerEvents="none"
        />
      )}

      {loading ? (
        <ActivityIndicator size="small" color={Glass.textPrimary} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <Text
            style={[
              styles.label,
              {
                fontSize,
                color: selected ? Glass.textPrimary : Glass.textSecondary,
              },
              textStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Glass.radius.primary,
    borderWidth: Glass.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  label: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
