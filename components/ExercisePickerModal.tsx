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
  SectionList,
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
import { EXERCISE_DATABASE, EXERCISES_BY_CATEGORY, searchExercises } from '../utils/exerciseDb/exerciseDatabase';
import type { Exercise as DbExercise } from '../utils/exerciseDb/types';
import * as Theme from '../constants/theme';
import { CreateExerciseAISheet } from './CreateExerciseAISheet';
import type { CreateExerciseInput } from '../utils/exerciseDb/types';

const { Colors, Typography, Spacing } = Theme;

// ── Layout constants ──────────────────────────────────────────────────────────
const R = 38;
const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_H = Math.round(SCREEN_H * 0.82);
const CLOSED_Y = SHEET_H + 40;   // off-screen
const OPEN_Y = 0;               // visible

// Dismiss thresholds
const DISMISS_Y = 90;
const DISMISS_VELOCITY = 900;

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
  /** User-created exercises to merge with built-in. Fetched from user_exercises when signed in. */
  userExercises?: DbExercise[];
  /** Create custom exercise. When provided, shows "Create exercise" row. Returns created exercise or null. */
  onCreateExercise?: (data: CreateExerciseInput) => Promise<DbExercise | null>;
}

export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  defaultRestTimer = 120,
  userExercises = [],
  onCreateExercise,
}: ExercisePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [localUserExercises, setLocalUserExercises] = useState<DbExercise[]>(userExercises);

  // ── Drag-to-close (attached to header only) ──────
  const translateY = useSharedValue(CLOSED_Y);
  const backdropOpacity = useSharedValue(0);

  const closeWithAnimation = () => {
    backdropOpacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(CLOSED_Y, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
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
      translateY.value = withTiming(OPEN_Y, { duration: 220, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) });
    } else {
      translateY.value = CLOSED_Y;
      backdropOpacity.value = 0;
    }
  }, [visible, translateY, backdropOpacity]);

  const effectiveUserExercises = localUserExercises.length > 0 ? localUserExercises : (userExercises ?? []);

  const categories = useMemo(() => {
    const fromBuiltIn = new Set(Object.keys(EXERCISES_BY_CATEGORY));
    effectiveUserExercises.forEach((ex) => fromBuiltIn.add(ex.category));
    return Array.from(fromBuiltIn).sort();
  }, [effectiveUserExercises]);

  const handleCreateExercise = async (data: CreateExerciseInput) => {
    if (!onCreateExercise) return null;
    const created = await onCreateExercise(data);
    if (created) {
      setShowCreateSheet(false);
      setLocalUserExercises((prev) => [...prev, created]);
      onSelect({ id: created.id, name: created.name, exerciseDbId: created.id, restTimer: defaultRestTimer });
      closeWithAnimation();
      return created;
    }
    return null;
  };

  const filteredExercises = useMemo(() => {
    const builtIn = EXERCISE_DATABASE;
    const user = effectiveUserExercises;
    const base = search.trim()
      ? searchExercises(search, builtIn, user)
      : [...builtIn, ...user];
    if (selectedCategory) {
      return base.filter((ex) => ex.category === selectedCategory);
    }
    return base;
  }, [search, selectedCategory, effectiveUserExercises]);

  // Group exercises into alphabetical sections for SectionList
  const exerciseSections = useMemo(() => {
    const map: Record<string, DbExercise[]> = {};
    for (const ex of filteredExercises) {
      const letter = ex.name[0]?.toUpperCase() ?? '#';
      if (!map[letter]) map[letter] = [];
      map[letter].push(ex);
    }
    return Object.keys(map)
      .sort()
      .map((letter) => ({ title: letter, data: map[letter] }));
  }, [filteredExercises]);

  const handleSelect = (ex: DbExercise) => {
    onSelect({ id: ex.id, name: ex.name, exerciseDbId: ex.id, restTimer: defaultRestTimer });
    setSearch('');
    closeWithAnimation();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnimation}>
      {/* Backdrop: only tap target for close; dimmed layer behind */}
      <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation}>
        <Animated.View style={[styles.backdrop, backdropAnimStyle]} pointerEvents="none" />
      </Pressable>

      {/* Sheet container: does not capture touches; sheet card below does */}
      <View style={styles.sheetContainer} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, sheetAnimStyle]} pointerEvents="box-none">
          <Pressable
            style={[styles.sheetCard, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}
            onPress={() => {}}
          >
            <View style={styles.sheetInner}>

          {/* HEADER (this is the ONLY drag handle zone) */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.headerDragZone}>
              <View style={styles.grabber} />
              <View style={styles.headerRow}>
                <Text style={styles.title}>add exercise</Text>
                <View style={styles.headerActions}>
                  <Pressable
                    style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                    onPress={closeWithAnimation}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={18} color={Colors.primaryLight} />
                  </Pressable>
                </View>
              </View>

              {/* SEARCH */}
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color="#C6C6C6" style={styles.searchIcon} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="search exercises..."
                  placeholderTextColor="rgba(198,198,198,0.4)"
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
            <SectionList
              sections={exerciseSections}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{title}</Text>
                </View>
              )}
              renderItem={({ item, index, section }) => {
                const isCustom = effectiveUserExercises.some((e) => e.id === item.id);
                const isLast = index === section.data.length - 1;
                return (
                  <Pressable
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => handleSelect(item)}
                  >
                    <View style={styles.rowInner}>
                      <View style={styles.rowText}>
                        <View style={styles.rowNameRow}>
                          <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                          {isCustom && (
                            <View style={styles.customPill}>
                              <Text style={styles.customPillText}>custom</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {item.equipment.join(', ')} · {item.movementType}
                        </Text>
                      </View>
                      <View style={styles.addBtn}>
                        <Ionicons name="add" size={16} color="#C6C6C6" />
                      </View>
                    </View>
                    {!isLast && <View style={styles.rowDivider} />}
                  </Pressable>
                );
              }}
              ListHeaderComponent={
                onCreateExercise ? (
                  <Pressable
                    style={({ pressed }) => [styles.createPill, pressed && styles.createPillPressed]}
                    onPress={() => setShowCreateSheet(true)}
                  >
                    <Text style={styles.createPillText}>+ Create Exercise</Text>
                  </Pressable>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No exercises match your search.</Text>
                </View>
              }
            />
          </View>

            </View>
          </Pressable>
        </Animated.View>
      </View>

      <CreateExerciseAISheet
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
        onSave={handleCreateExercise}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 2,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  },
  sheet: {
    width: '100%',
    height: SHEET_H,
    overflow: 'hidden',
  },
  sheetCard: {
    flex: 1,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: '#2F3031',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  sheetInner: {
    flex: 1,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(198,198,198,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.18)',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  searchIcon: {
    marginRight: 8,
    alignSelf: 'center',
  },
  searchInput: {
    flex: 1,
    height: 44,
    paddingVertical: 0,
    marginTop: 0,
    marginBottom: 0,
    fontSize: 15,
    color: '#FFFFFF',
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
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  sectionHeader: {
    backgroundColor: 'rgba(198,198,198,0.04)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#C6C6C6',
    textTransform: 'uppercase',
  },
  row: {
    paddingHorizontal: Spacing.md,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: 12,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 0,
  },
  rowText: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  customPill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(198,198,198,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.18)',
  },
  customPillText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#C6C6C6',
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: '#C6C6C6',
    marginTop: 2,
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: R,
    backgroundColor: 'rgba(198,198,198,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPill: {
    height: 44,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: 'rgba(198,198,198,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  createPillPressed: {
    backgroundColor: 'rgba(198,198,198,0.06)',
  },
  createPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C6C6C6',
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
