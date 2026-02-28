import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Colors, Typography, Spacing, BorderRadius } from '../../constants/theme';
import { BackButton } from '../BackButton';

const AVATAR_SIZE = 88;
const GRID_GAP = 2;
const GRID_COLUMNS = 3;

export type ExploreProfileModalProps = {
  visible: boolean;
  onClose: () => void;
};

/** Mock posts count for grid; replace with real data later. */
const MOCK_MY_POSTS_COUNT = 12;

export function ExploreProfileModal({ visible, onClose }: ExploreProfileModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;
  const contentWidth = screenWidth - Spacing.md * 2;
  const cellSize = (contentWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  if (!visible) return null;

  const BACK_ROW_HEIGHT = 54 + 48;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})} />
      </Pressable>
      <View style={[styles.container, { top: 54, paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <View style={styles.backRow}>
          <BackButton style={{ position: 'relative', top: 0, left: 0 }} onPress={onClose} />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingTop: BACK_ROW_HEIGHT, paddingBottom: Spacing.xl + insets.bottom, alignItems: 'center' }]}
        >
          <View style={[styles.inner, { width: '100%' }]} onStartShouldSetResponder={() => true}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, { backgroundColor: colors.primaryLight + '25' }]}>
                <Text style={[styles.avatarText, { color: colors.primaryLight }]}>?</Text>
              </View>
            </View>
            <View style={styles.statsRowWrap}>
              <View style={styles.statsRow}>
                <View style={styles.statBlock}>
                  <Text style={[styles.statValue, { color: colors.primaryLight }]}>{MOCK_MY_POSTS_COUNT}</Text>
                  <Text style={[styles.statLabel, { color: colors.primaryLight + '99' }]}>posts</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={[styles.statValue, { color: colors.primaryLight }]}>0</Text>
                  <Text style={[styles.statLabel, { color: colors.primaryLight + '99' }]}>followers</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={[styles.statValue, { color: colors.primaryLight }]}>0</Text>
                  <Text style={[styles.statLabel, { color: colors.primaryLight + '99' }]}>following</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.sectionLabel, { color: colors.primaryLight }]}>Posts</Text>
            <View style={styles.grid}>
              {Array.from({ length: MOCK_MY_POSTS_COUNT }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.gridCell,
                    {
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: colors.primaryLight + '12',
                      marginRight: i % GRID_COLUMNS < GRID_COLUMNS - 1 ? GRID_GAP : 0,
                      marginBottom: GRID_GAP,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 0,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.primaryDarkLighter,
  },
  backRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    justifyContent: 'center',
    paddingLeft: Spacing.lg,
    zIndex: 10,
  },
  inner: {
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
  },
  statsRowWrap: {
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  statBlock: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
  },
  statLabel: {
    fontSize: Typography.label,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: Typography.body,
    fontWeight: '600',
    letterSpacing: -0.11,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  gridCell: {
    borderRadius: 4,
  },
});
