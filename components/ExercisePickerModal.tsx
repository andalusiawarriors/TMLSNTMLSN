// ============================================================
// TMLSN — ExercisePickerModal
// Fixed-height sheet, drag-to-close on chrome, R=38 pill system
// ============================================================

import React, { useState, useMemo } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { EXERCISE_DATABASE, EXERCISES_BY_CATEGORY } from '../utils/exerciseDb/exerciseDatabase';
import type { Exercise as DbExercise } from '../utils/exerciseDb/types';
import * as Theme from '../constants/theme';

const { Colors, Typography, Spacing } = Theme;

// ── Layout constants ──────────────────────────────────────────────────────────
// R = dominant border-radius for every pill/card surface in this modal.
const R = 38;
const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = Math.round(SCREEN_H * 0.78);
const SHEET_TOP = Math.round(SCREEN_H * 0.10);

// Gradient border ring + fill (same as Card.tsx gradientFill)
const SHEET_BORDER_GRADIENT: [string, string] = ['#525354', '#48494A'];
const SHEET_FILL_GRADIENT: [string, string] = ['#363738', '#2E2F30'];

// Dismiss thresholds
const DISMISS_Y = 80;   // px downward before we let go
const DISMISS_VELOCITY = 900;  // px/s downward flick

// Spring config for snap-back (matches PillSegmentedControl)
const SPRING_CFG = { damping: 28, stiffness: 460, mass: 0.4 };

// ── Category labels ───────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms',
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes',
  calves: 'Calves', abs: 'Abs', full_body: 'Full Body',
  cardio: 'Cardio', olympic: 'Olympic',
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: { id: string; name: string; exerciseDbId: string; restTimer: number }) => void;
  defaultRestTimer?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  defaultRestTimer = 120,
}: ExercisePickerModalProps) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Drag-to-close (attached to chrome only — list scroll is untouched) ──────
  const translateY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow downward drag
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > DISMISS_Y || e.velocityY > DISMISS_VELOCITY) {
        // Animate off-screen then close
        translateY.value = withSpring(SHEET_H, { ...SPRING_CFG, damping: 20 });
        runOnJS(onClose)();
      } else {
        // Snap back
        translateY.value = withSpring(0, SPRING_CFG);
      }
    });

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Reset translate when modal opens/closes
  React.useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible]);

  // ── Data ──────────────────────────────────────────────────────────────────
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
    onClose();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>

      {/* ── Scrim: tapping closes modal ───────────────────────────────── */}
      <Pressable style={styles.scrim} onPress={onClose} />

      {/* ── Sheet: fixed position + height, animated translateY ──────── */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, Spacing.md) },
          sheetAnimStyle,
        ]}
      >
        {/* Gradient border ring (1px) */}
        <LinearGradient
          colors={SHEET_BORDER_GRADIENT}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Gradient fill (inset 1px) */}
        <LinearGradient colors={SHEET_FILL_GRADIENT} style={styles.sheetFill} />

        {/* ── TOP CHROME: pan gesture attached here only ─────────────── */}
        <GestureDetector gesture={panGesture}>
          <View style={styles.chrome}>
            {/* Grabber bar */}
            <View style={styles.handle} />

            {/* Header row — X is a plain Pressable, not inside GestureDetector */}
            <View style={styles.header}>
              <Text style={styles.title}>add exercise</Text>
              <Pressable
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
              >
                <Ionicons name="close" size={18} color={Colors.primaryLight} />
              </Pressable>
            </View>

            {/* Search bar */}
            <View style={styles.searchWrap}>
              <Ionicons
                name="search"
                size={16}
                color={Colors.primaryLight}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.search}
                placeholder="search exercises..."
                placeholderTextColor={Colors.primaryLight + '45'}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="none"
                textAlignVertical="center"
                {...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {})}
              />
            </View>

            {/* Category filter chips */}
            <View style={styles.chipOuter}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.chip,
                    !selectedCategory && styles.chipActive,
                    pressed && styles.chipPressed,
                  ]}
                  onPress={() => setSelectedCategory(null)}
                >
                  <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>
                    all
                  </Text>
                </Pressable>

                {categories.map((cat) => (
                  <Pressable
                    key={cat}
                    style={({ pressed }) => [
                      styles.chip,
                      selectedCategory === cat && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() =>
                      setSelectedCategory(selectedCategory === cat ? null : cat)
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedCategory === cat && styles.chipTextActive,
                      ]}
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </GestureDetector>

        {/* ── SCROLL AREA: FlatList only, gesture NOT attached here ─── */}
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
      </Animated.View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  // Scrim absorbs taps; positioned here so it does not interfere with sheet gestures
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: SHEET_TOP + 20,   // covers only the area above the sheet
    backgroundColor: 'rgba(0,0,0,0.52)',
  },

  // Fixed-size sheet: position absolute, constant height = 78% of screen
  sheet: {
    position: 'absolute',
    top: SHEET_TOP,
    left: Spacing.md,
    right: Spacing.md,
    height: SHEET_H,
    borderRadius: R,
    overflow: 'hidden',   // required so gradient corners clip correctly
  },

  // Gradient fill sits 1px inset from the border gradient layer
  sheetFill: {
    position: 'absolute',
    top: 1, left: 1, right: 1, bottom: 0,
    borderRadius: R - 1,
  },

  // Top chrome wrapper (pan gesture attached here)
  chrome: {
    // No overflow:hidden — chips must not be clipped
    overflow: 'visible',
  },

  // ── Grabber ──────────────────────────────────────────────────────────────
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primaryLight + '40',
    marginTop: 10,
    marginBottom: 10,
  },

  // ── Header row ───────────────────────────────────────────────────────────
  header: {
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

  // ── Search bar ───────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '09',
    borderWidth: 1,
    borderColor: Colors.primaryLight + '15',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: 0, // padded per-child below
  },
  searchIcon: {
    marginLeft: 14,
    marginRight: 10,
    alignSelf: 'center',
    opacity: 0.5,
  },
  search: {
    flex: 1,
    height: 48,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.11,
    color: Colors.primaryLight,
    paddingVertical: 0,
    lineHeight: 17,
    textAlignVertical: 'center',
    paddingRight: 14,
  },

  // ── Chip row ─────────────────────────────────────────────────────────────
  // Outer view: explicit height, overflow visible so chips are never clipped
  chipOuter: {
    height: 46,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  chipRow: {
    paddingHorizontal: Spacing.md,
    gap: 10,
    alignItems: 'center',
  },
  chip: {
    height: 40,
    borderRadius: R,
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

  // ── List ─────────────────────────────────────────────────────────────────
  list: {
    flex: 1,   // takes all remaining sheet height; sheet height is fixed
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    gap: 7,
  },

  // Exercise row: R pill, fill only
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

  // Add icon pill
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: R,
    backgroundColor: Colors.primaryLight + '0E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
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

/*
 * ── Notes ───────────────────────────────────────────────────────────────────
 * A) Sheet is fixed: top=SHEET_TOP(10%), height=SHEET_H(78%),
 *    left/right=Spacing.md, borderRadius=R=38. Height never changes regardless
 *    of chip count or list length.
 *
 * B) Drag gesture is attached to <GestureDetector> wrapping only the top
 *    chrome (grabber + header + search + chip row). The FlatList is outside
 *    the GestureDetector and receives native scroll events untouched.
 *
 * C) Dismiss: translateY > 80px OR velocityY > 900px/s → runOnJS(onClose).
 *    Otherwise → withSpring(0, SPRING_CFG) snap back.
 *
 * D) Scrim covers only the ~10% ribbon above the sheet (matches SHEET_TOP),
 *    so tapping that area closes. The sheet itself is not a Pressable.
 *
 * E) X button is a plain Pressable inside the chrome View but NOT wrapped in
 *    a GestureDetector — Pressable events are not swallowed by the pan gesture
 *    on tap (only on sustained drag).
 *
 * ── Verification checklist ──────────────────────────────────────────────────
 * Visual:
 *   [ ] Sheet is floating (margins left/right), all 4 corners rounded at R=38
 *   [ ] Sheet position + height constant — does not grow/shrink with content
 *   [ ] Grabber bar centered, 44×5, subtle opacity
 *   [ ] Chips fully visible, same height, no vertical clipping
 *   [ ] Search input text vertically centered, placeholder correct
 *
 * Interaction:
 *   [ ] Dragging grabber/header downwards > 80px → modal closes
 *   [ ] Flicking downward fast → modal closes
 *   [ ] Partial drag < 80px → sheet springs back
 *   [ ] X button closes instantly without triggering pan
 *   [ ] Tapping scrim ribbon above sheet closes
 *   [ ] FlatList scrolls normally (pan gesture NOT on list)
 *   [ ] Search still filters; chips still filter; row tap selects
 * ────────────────────────────────────────────────────────────────────────────
 */
