import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TmlsnRoutinesScreen from './(tabs)/workout/tmlsn-routines';
import { useTheme } from '../context/ThemeContext';

const TOP_PADDING_BASE = 24;
/** Extra space so the first card (e.g. TMLSN Upper Body A) sits well below the top. */
const TOP_EXTRA = 56;

/**
 * Root-level modal for TMLSN routines (opened from FAB).
 * Full-screen modal; swipe down to dismiss. First card is pushed down from the top.
 */
export default function TmlsnRoutinesModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const onStartRoutine = (split: { id: string }) => {
    router.back();
    setTimeout(() => {
      router.replace({ pathname: '/workout', params: { startSplitId: split.id } });
    }, 0);
  };

  const paddingTop = Math.max(insets.top, TOP_PADDING_BASE) + TOP_EXTRA;

  return (
    <View style={[styles.wrapper, { paddingTop, backgroundColor: colors.primaryDark }]}>
      <TmlsnRoutinesScreen onStartRoutine={onStartRoutine} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});
