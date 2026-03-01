import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { ADD_MEAL_UNITS, UNIT_TO_GRAMS, type AddMealUnit } from '../utils/unitGrams';

export { ADD_MEAL_UNITS, UNIT_TO_GRAMS, resolveGrams, type AddMealUnit } from '../utils/unitGrams';

import type { ParsedNutrition } from '../utils/foodApi';

/**
 * Choose the best default unit and amount when a food is first selected.
 * Priority: whole-item USDA portion (e.g. "1 medium") > liquid (100ml) > 100g.
 */
export function getSmartDefaultUnit(food: ParsedNutrition): { unit: string; amount: string } {
  const portions = food.portions ?? [];
  const wholeItem = portions.find(p =>
    /^1\s+(medium|large|small|extra\s+large|whole|unit|piece|serving|bar|packet|bottle|can|slice|scoop)\b/i.test(p.label)
  );
  if (wholeItem) return { unit: wholeItem.label, amount: '1' };
  if (food.unit === 'ml') return { unit: '100ml', amount: '1' };
  return { unit: '100g', amount: '1' };
}

function unitLabel(u: AddMealUnit): string {
  const labels: Record<AddMealUnit, string> = {
    tbsp: 'tbsp',
    tsp: 'tsp',
    cup: 'cup',
    '2cup': '2 cups',
    halfCup: 'half cup',
    '100g': '100g',
    '1g': '1g',
  };
  return labels[u];
}

const ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;
const PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;
const MODAL_CONTENT_WIDTH = 300;

// Snap offset for item i = scroll Y where item i is centered (center = y + WHEEL_HEIGHT/2 = 110 + 44*i)
const SNAP_OFFSETS = ADD_MEAL_UNITS.map((_, i) => i * ITEM_HEIGHT);

type UnitWheelPickerProps = {
  value: AddMealUnit;
  onValueChange: (u: AddMealUnit) => void;
  compact?: boolean;
};

export function UnitWheelPicker({ value, onValueChange, compact }: UnitWheelPickerProps) {
  const [visible, setVisible] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastSettledIndexRef = useRef(-1);
  const lastOffsetYRef = useRef(0);
  const [settledIndex, setSettledIndex] = useState(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rawIndex = ADD_MEAL_UNITS.indexOf(value);
  const selectedIndex = rawIndex >= 0 ? rawIndex : 0;

  const syncValueFromOffset = useCallback(
    (y: number) => {
      const raw = Math.round(y / ITEM_HEIGHT);
      const index = Math.max(0, Math.min(raw, ADD_MEAL_UNITS.length - 1));
      if (index !== lastSettledIndexRef.current) {
        lastSettledIndexRef.current = index;
        setSettledIndex(index);
        onValueChange(ADD_MEAL_UNITS[index]);
        Haptics.selectionAsync();
      }
    },
    [onValueChange]
  );

  const handleScrollEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      lastOffsetYRef.current = y;
      syncValueFromOffset(y);
    },
    [syncValueFromOffset]
  );

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      lastOffsetYRef.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  const handleContentSizeChange = useCallback(() => {
    if (!visible) return;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      const offset = SNAP_OFFSETS[selectedIndex];
      scrollRef.current?.scrollTo({
        y: offset,
        animated: false,
      });
      lastOffsetYRef.current = offset;
      lastSettledIndexRef.current = selectedIndex;
      setSettledIndex(selectedIndex);
      scrollTimeoutRef.current = null;
    }, 16);
  }, [visible, selectedIndex]);

  const openPicker = useCallback(() => {
    lastOffsetYRef.current = SNAP_OFFSETS[selectedIndex];
    lastSettledIndexRef.current = selectedIndex;
    setSettledIndex(selectedIndex);
    setVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [selectedIndex]);

  const closePicker = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  const handleDone = useCallback(() => {
    syncValueFromOffset(lastOffsetYRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closePicker();
  }, [closePicker, syncValueFromOffset]);

  return (
    <>
      <TouchableOpacity
        style={[styles.triggerOuter, compact && styles.triggerCompact]}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={Colors.cardBorderGradient as [string, string]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.triggerGradient]}
        />
        <View style={[styles.triggerInner, { backgroundColor: Colors.cardFillGradient[1] }, compact && styles.triggerInnerCompact]}>
          <Text style={[styles.triggerText, compact && styles.triggerTextCompact]}>{unitLabel(value)}</Text>
          <Text style={[styles.triggerChevron, compact && styles.triggerChevronCompact]}>⌄</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalBackdrop} onPress={closePicker}>
          <BlurView
            intensity={50}
            tint="dark"
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
          />
          <View style={[StyleSheet.absoluteFill, styles.blurTintOverlay]} />
        </Pressable>
        <View style={styles.modalContentWrap} pointerEvents="box-none">
          <View style={styles.modalContent}>
            <View style={styles.wheelWrap}>
              {/* Top edge fade */}
              <LinearGradient
                colors={[Colors.primaryDark, 'transparent']}
                style={[styles.edgeFade, styles.edgeFadeTop]}
                pointerEvents="none"
              />
              {/* Bottom edge fade */}
              <LinearGradient
                colors={['transparent', Colors.primaryDark]}
                style={[styles.edgeFade, styles.edgeFadeBottom]}
                pointerEvents="none"
              />
              {/* iOS-style selection separators */}
              <View style={[styles.selectionSeparators, { top: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2 }]}>
                <View style={styles.separatorLine} />
                <View style={[styles.selectionCenter, { height: ITEM_HEIGHT }]} />
                <View style={styles.separatorLine} />
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.wheelScroll}
                contentContainerStyle={styles.wheelContent}
                onContentSizeChange={handleContentSizeChange}
                scrollEnabled={true}
                showsVerticalScrollIndicator={false}
                snapToOffsets={SNAP_OFFSETS}
                snapToAlignment="start"
                decelerationRate="fast"
                onScroll={handleScroll}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={handleScrollEnd}
                scrollEventThrottle={16}
              >
                {ADD_MEAL_UNITS.map((u, i) => (
                  <View key={u} style={styles.wheelItem}>
                    <Text
                      style={[
                        styles.wheelItemText,
                        i === settledIndex ? styles.wheelItemTextSelected : styles.wheelItemTextDimmed,
                      ]}
                    >
                      {unitLabel(u)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.doneButtonOuter}
              onPress={handleDone}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={Colors.tabBarBorder as [string, string]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.doneButtonGradient]}
              />
              <View style={[styles.doneButtonInner, { backgroundColor: Colors.tabBarFill[1] }]}>
                <Text style={styles.doneButtonText}>Done</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerOuter: {
    alignSelf: 'stretch',
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    minHeight: 52,
  },
  triggerCompact: {
    alignSelf: 'center',
    marginBottom: 0,
    minHeight: 44,
    minWidth: 80,
  },
  triggerGradient: {
    borderRadius: BorderRadius.md,
  },
  triggerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md - 1,
    minHeight: 50,
  },
  triggerInnerCompact: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 42,
  },
  triggerText: {
    fontSize: Typography.body,
    fontWeight: '500',
    color: Colors.primaryLight,
  },
  triggerChevron: {
    fontSize: 14,
    color: Colors.primaryLight,
    opacity: 0.8,
  },
  triggerTextCompact: {
    fontSize: Typography.label,
  },
  triggerChevronCompact: {
    fontSize: 12,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  blurTintOverlay: {
    backgroundColor: 'rgba(47, 48, 49, 0.5)',
    pointerEvents: 'none',
  },
  modalContentWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    width: MODAL_CONTENT_WIDTH,
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingBottom: 34,
    paddingHorizontal: Spacing.lg,
  },
  wheelWrap: {
    height: WHEEL_HEIGHT,
    position: 'relative',
    marginVertical: Spacing.md,
  },
  edgeFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: PADDING,
    zIndex: 1,
  },
  edgeFadeTop: {
    top: 0,
  },
  edgeFadeBottom: {
    bottom: 0,
  },
  selectionSeparators: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: 'stretch',
    pointerEvents: 'none',
  },
  separatorLine: {
    height: 1,
    backgroundColor: Colors.primaryLight + '33',
  },
  selectionCenter: {
    width: '100%',
  },
  wheelScroll: {
    flex: 1,
  },
  wheelContent: {
    paddingVertical: PADDING,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelItemText: {
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  wheelItemTextSelected: {
    fontWeight: '600',
    opacity: 1,
  },
  wheelItemTextDimmed: {
    fontWeight: '500',
    opacity: 0.6,
  },
  doneButtonOuter: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  doneButtonGradient: {
    borderRadius: BorderRadius.md,
  },
  doneButtonInner: {
    margin: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.md - 1,
  },
  doneButtonText: {
    fontSize: Typography.body,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
});
