// ─────────────────────────────────────────────────────────────────────────────
// GlassLayers — shared 6-layer glass stack used by all liquid glass components
//
// Layers: blur → fill → diagonal specular → top-rim lensing → depth shadow → border
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { LG, BLUR } from './tokens';

export function GlassLayers({
  radius,
  intensity = BLUR.track,
}: {
  radius: number;
  intensity?: number;
}) {
  const r = { borderRadius: radius };
  return (
    <>
      <BlurView intensity={intensity} tint="dark" style={[StyleSheet.absoluteFillObject, r]} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: LG.fill }, r]} />
      <LinearGradient
        colors={LG.specDiag as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 0.85 }}
        style={[StyleSheet.absoluteFillObject, r]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={LG.specTop as unknown as string[]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.22 }}
        style={[StyleSheet.absoluteFillObject, r]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={LG.depthBottom as unknown as string[]}
        start={{ x: 0.5, y: 0.6 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFillObject, r]}
        pointerEvents="none"
      />
      <View
        style={[StyleSheet.absoluteFillObject, r, { borderWidth: 1, borderColor: LG.border }]}
        pointerEvents="none"
      />
    </>
  );
}
