import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton } from '../BackButton';
import { Colors, Spacing } from '../../constants/theme';

const BACK_TOP = 54;
const CONTENT_TOP = BACK_TOP + 48;

type ExploreProfileModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function ExploreProfileModal({ visible, onClose }: ExploreProfileModalProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={[styles.backRow, { top: BACK_TOP }]}>
            <BackButton onPress={onClose} style={{ position: 'relative', top: 0, left: 0 }} />
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: CONTENT_TOP }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.avatarWrap}>
            <View style={styles.avatar} />
          </View>
          <View style={styles.statsRowWrap}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>posts</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>followers</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statLabel}>following</Text>
            </View>
          </View>
          <View style={styles.grid}>
            <Text style={styles.gridPlaceholder}>Posts grid</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  backRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: Spacing.xl,
  },
  avatarWrap: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryLight + '30',
  },
  statsRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.primaryLight + '99',
    marginTop: 2,
  },
  grid: {
    width: '100%',
    minHeight: 200,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridPlaceholder: {
    fontSize: 14,
    color: Colors.primaryLight + '60',
  },
});
