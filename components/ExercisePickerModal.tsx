// ============================================================
// TMLSN — ExercisePickerModal
// Fixed-height sheet, drag-to-close on header, R=38 pill system
// ============================================================

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { EXERCISE_DATABASE, EXERCISES_BY_CATEGORY } from '../utils/exerciseDb/exerciseDatabase';
import type { Exercise as DbExercise } from '../utils/exerciseDb/types';
import * as Theme from '../constants/theme';

const { Colors, Typography, Spacing } = Theme;

// ── Layout constants ──────────────────────────────────────────────────────────
const R = 38;
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_H = Math.round(SCREEN_H * 0.78);
const SHEET_TOP = Math.round(SCREEN_H * 0.10);

// Dismiss thresholds
const DISMISS_Y = 80;   // px downward before we let go
const DISMISS_VELOCITY = 900;  // px/s downward flick

// Spring config for snap-back
const SPRING_CFG = { damping: 28, stiffness: 460, mass: 0.4 };

// ── Category labels ───────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', full_body: 'Full Body',
  cardio: 'Cardio', olympic: 'Olympic',
};

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: { id: string; name: string; exerciseDbId: string; restTimer: number }) => void;
  defaultRestTimer?: number;
}

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  defaultRestTimer = 120,
}: ExercisePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Drag-to-close (attached to header only) ──────
  const translateY = useSharedValue(SCREEN_H); // start off-screen
  const backdropOpacity = useSharedValue(0);

  const closeWithAnimation = () => {
    translateY.value = withSpring(SCREEN_H, { ...SPRING_CFG, damping: 20 });
    backdropOpacity.value = withTiming(0, { duration: 200 });
    setTimeout(onClose, 200); // Wait for animation before unmounting
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_Y || e.velocityY > DISMISS_VELOCITY) {
        runOnJS(closeWithAnimation)();
      } else {
        // Snap back
        translateY.value = withSpring(0, SPRING_CFG);
      }
    });

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING_CFG);
      backdropOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    } else {
      translateY.value = Math.max(SCREEN_H, translateY.value);
      backdropOpacity.value = 0;
    }
  }, [visible, translateY, backdropOpacity]);

  const categories = useMemo(
    () => Object.keys(EXERCISES_BY_CATEGORY).sort(),
    []
  );

  const filteredExercises = useMemo(() => {
    const cat = selectedCategory
      ? EXERCISES_BY_CATEGORY[selectedCategory] ?? []
      : EXERCISE_DATABASE;
    const q = search.toLowerCase().trim();
    if (!q) return cat;
    return cat.filter(
      (ex) =>
        ex.name.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        ex.equipment.some((e) => e.toLowerCase().includes(q))
    );
  }, [search, selectedCategory]);

  const handleSelect = (ex: DbExercise) => {
    onSelect({ id: ex.id, name: ex.name, exerciseDbId: ex.id, restTimer: defaultRestTimer });
    setSearch('');
    closeWithAnimation();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnimation}>
      <Animated.View style={[styles.backdrop, backdropAnimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetAnimStyle]} pointerEvents="box-none">
        <View style={[styles.sheetInner, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>

          {/* HEADER (this is the ONLY drag handle zone) */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.headerDragZone}>
              <View style={styles.grabber} />
              <View style={styles.headerRow}>
                <Text style={styles.title}>add exercise</Text>
                <Pressable
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                  onPress={closeWithAnimation}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color={Colors.primaryLight} />
                </Pressable>
              </View>

              {/* SEARCH */}
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color={Colors.primaryLight + '60'} style={styles.searchIcon} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="search exercises..."
                  placeholderTextColor={Colors.primaryLight + '40'}
                  style={styles.searchInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  textAlignVertical="center"
                  {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
                />
              </View>

              {/* CHIPS */}
              <View style={styles.chipsWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsContent}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.chip,
                      !selectedCategory && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => setSelectedCategory(null)}
                  >
                    <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>all</Text>
                  </Pressable>

                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      style={({ pressed }) => [
                        styles.chip,
                        selectedCategory === cat && styles.chipActive,
                        pressed && styles.chipPressed,
                      ]}
                      onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    >
                      <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                        {CATEGORY_LABELS[cat] ?? cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </Animated.View>
          </GestureDetector>

          {/* LIST (only this scrolls) */}
          <View style={styles.listWrap}>
            <FlatList
              data={filteredExercises}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => handleSelect(item)}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {item.equipment.join(', ')} · {item.movementType}
                    </Text>
                  </View>
                  <View style={styles.addBtn}>
                    <Ionicons name="add" size={16} color={Colors.primaryLight + '60'} />
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No exercises match your search.</Text>
                </View>
              }
            />
          </View>

        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 1,
  },
  sheet: {
    position: 'absolute',
    top: SHEET_TOP,
    left: Spacing.md,
    right: Spacing.md,
    height: SHEET_H,
    borderRadius: 38,
    overflow: 'hidden',
    zIndex: 10,
  },
  sheetInner: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 38,
  },
  headerDragZone: {
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight + '40',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: Colors.primaryLight + '1C',
    opacity: 0.85,
  },
  searchWrap: {
    height: 48,
    borderRadius: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    marginRight: 10,
    alignSelf: 'center',
  },
  searchInput: {
    flex: 1,
    height: 48,
    paddingVertical: 0,
    marginTop: 0,
    marginBottom: 0,
    fontSize: 15,
    lineHeight: 17,
    color: Colors.primaryLight,
    ...(Platform.OS === 'android' ? { textAlignVertical: 'center' } : {}),
  },
  chipsWrap: {
    height: 46,
    justifyContent: 'center',
    overflow: 'visible',
    marginBottom: Spacing.sm,
  },
  chipsContent: {
    paddingHorizontal: Spacing.md,
    gap: 10,
    alignItems: 'center',
    paddingBottom: 2,
  },
  chip: {
    height: 40,
    borderRadius: 38,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight + '0C',
  },
  chipActive: {
    backgroundColor: Colors.primaryLight + '18',
  },
  chipPressed: {
    opacity: 0.72,
  },
  chipText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '600',
    letterSpacing: -0.11,
    textAlignVertical: 'center',
    color: Colors.primaryLight + 'A0',
  },
  chipTextActive: {
    color: Colors.primaryLight,
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '09',
  },
  rowPressed: {
    backgroundColor: Colors.primaryLight + '15',
  },
  rowText: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
  },
  rowMeta: {
    fontSize: Typography.label,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight + '70',
    marginTop: 2,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '0E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.body,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight + '55',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
