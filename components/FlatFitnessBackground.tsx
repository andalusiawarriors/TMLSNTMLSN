import React from 'react';
import { View, StyleSheet } from 'react-native';

const FITNESS_BG = '#1A1A1A';

export function FlatFitnessBackground() {
  return (
    <View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: FITNESS_BG, zIndex: 0 }]}
      pointerEvents="none"
    />
  );
}
