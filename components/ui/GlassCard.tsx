import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass } from '../../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  noPadding?: boolean;
  /** Increase blur intensity beyond default for more dramatic cards */
  blurIntensity?: number;
}

export function GlassCard({
  children,
  style,
  radius = Glass.radius.primary,
  noPadding = false,
  blurIntensity = Glass.blurIntensity,
}: GlassCardProps) {
  return (
    <View style={[styles.outer, Glass.shadow, { borderRadius: radius }, style]}>
      {/* iOS Liquid Glass base layer — backdrop blur */}
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
      />

      {/* Dark fill tint over the blur */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: Glass.fill, borderRadius: radius },
        ]}
      />

      {/* Specular highlight — top edge reflection (the iOS glass "sheen") */}
      <LinearGradient
        colors={[Glass.specularStrong, Glass.specular, 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
        pointerEvents="none"
      />

      {/* Border rim — the "lensing" edge */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: radius,
            borderWidth: Glass.borderWidth,
            borderColor: Glass.border,
          },
        ]}
        pointerEvents="none"
      />

      {/* Content */}
      <View style={[styles.content, { flex: 1 }, noPadding ? undefined : styles.padding]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
  },
  content: {
    zIndex: 1,
  },
  padding: {
    padding: 20,
  },
});
