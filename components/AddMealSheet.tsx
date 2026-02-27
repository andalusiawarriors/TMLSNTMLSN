// ============================================================
// TMLSN — AddMealSheet
// Half-screen bottom sheet for logging a food (quantity, unit, meal type).
// Hierarchy: header → title (one line) → meal type pill → calories + P/C/F → quantity/unit → Add Meal (sticky).
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Image,
  ImageSourcePropType,
  Dimensions,
  LayoutChangeEvent,
  Platform,
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
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { ArrowDown } from 'phosphor-react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Button } from './Button';
import { Input } from './Input';
import { ADD_MEAL_UNITS, type AddMealUnit } from './UnitWheelPicker';
import * as Theme from '../constants/theme';
import type { MealType } from '../types';
import * as Haptics from 'expo-haptics';

const { Colors, Typography, Spacing, BorderRadius } = Theme;
const TAB_BAR_BORDER = Colors.tabBarBorder as [string, string];
const TAB_BAR_FILL = Colors.tabBarFill as [string, string];
const MEAL_PILL_INSET = 2;
const MEAL_PILL_HEIGHT = 32;
const MEAL_PILL_RADIUS = 16;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = Math.round(SCREEN_H * 0.52);
const MESH_ELLIPSE_SIZE = 800;
const CLOSED_Y = SHEET_H + 40;
const OPEN_Y = 0;
const DISMISS_Y = 90;
const DISMISS_VELOCITY = 900;
const SPRING_CFG = { damping: 28, stiffness: 460, mass: 0.4 };
const R = 38;

const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

function unitDisplayLabel(u: AddMealUnit): string {
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

/** Hex color to rgba with given alpha */
function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Lighten a hex color by mixing with white (amount 0–1, e.g. 0.22 = 22% brighter) */
function lightenColor(color: string, amount: number): string {
  let hex = color.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = Math.min(255, Math.round(parseInt(hex.slice(0, 2), 16) + (255 - parseInt(hex.slice(0, 2), 16)) * amount));
  const g = Math.min(255, Math.round(parseInt(hex.slice(2, 4), 16) + (255 - parseInt(hex.slice(2, 4), 16)) * amount));
  const b = Math.min(255, Math.round(parseInt(hex.slice(4, 6), 16) + (255 - parseInt(hex.slice(4, 6), 16)) * amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export interface AddMealSheetProps {
  visible: boolean;
  onClose: () => void;
  mealName: string;
  addMealTitleBrand: string;
  addMealBrandName: string;
  mealType: MealType;
  setMealType: (t: MealType) => void;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  setCalories?: (s: string) => void;
  setProtein?: (s: string) => void;
  setCarbs?: (s: string) => void;
  setFat?: (s: string) => void;
  addMealUnit: AddMealUnit;
  setAddMealUnit: (u: AddMealUnit) => void;
  addMealAmount: string;
  setAddMealAmount: (s: string) => void;
  onSubmit: () => void;
  hasSelectedFood: boolean;
  goldBadge: ImageSourcePropType;
  quicksilverBadge: ImageSourcePropType;
  champagneGradient: readonly string[];
  quicksilverGradient: readonly string[];
  verifiedTickSize?: number;
}

export function AddMealSheet({
  visible,
  onClose,
  mealName,
  addMealTitleBrand,
  addMealBrandName,
  mealType,
  setMealType,
  calories,
  protein,
  carbs,
  fat,
  setCalories,
  setProtein,
  setCarbs,
  setFat,
  addMealUnit,
  setAddMealUnit,
  addMealAmount,
  setAddMealAmount,
  onSubmit,
  hasSelectedFood,
  goldBadge,
  quicksilverBadge,
  champagneGradient,
  quicksilverGradient,
  verifiedTickSize = 18,
}: AddMealSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(CLOSED_Y);
  const backdropOpacity = useSharedValue(0);
  const mealSegmentWidth = useSharedValue(0);
  const mealSelectedIndex = useSharedValue(MEAL_TYPE_ORDER.indexOf(mealType));

  useEffect(() => {
    mealSelectedIndex.value = withSpring(MEAL_TYPE_ORDER.indexOf(mealType), SPRING_CFG);
  }, [mealType, mealSelectedIndex]);

  const onMealPillLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    mealSegmentWidth.value = (w - 2 * MEAL_PILL_INSET) / 4;
  }, [mealSegmentWidth]);

  const mealThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: MEAL_PILL_INSET + mealSelectedIndex.value * mealSegmentWidth.value }],
    width: mealSegmentWidth.value,
  }));

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

  const isTop100 = addMealTitleBrand.trim().toUpperCase() === 'TMLSN TOP 100';
  const isVerified = addMealTitleBrand.trim().toUpperCase() === 'TMLSN VERIFIED';
  const displayName = mealName.trim() || 'add meal';

  // Mesh type: gold (Top 100), quicksilver (Verified), neutral (plain)
  // Gold/quicksilver: raw gradient + extra "peak highlight" ellipse (lightened first color) so blur result matches the linear gradient's highlight.
  const meshType = isTop100 ? 'gold' : isVerified ? 'quicksilver' : 'neutral';
  const rawMeshColors = meshType === 'gold' ? champagneGradient : meshType === 'quicksilver' ? quicksilverGradient : [Colors.primaryDark, Colors.primaryDarkLighter];
  const isLightMesh = meshType === 'gold' || meshType === 'quicksilver';
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);

  const meshColors =
    meshType === 'neutral'
      ? rawMeshColors.map((c) => lightenColor(c, 0.22))
      : meshType === 'gold'
        ? [
            lightenColor(rawMeshColors[0], 0.7),
            lightenColor(rawMeshColors[0], 0.56),
            lightenColor(rawMeshColors[0], 0.1),
            lightenColor(rawMeshColors[0], 0.1),
            lightenColor(rawMeshColors[1], 0.06),
            lightenColor(rawMeshColors[1], 0.06),
            lightenColor(rawMeshColors[0], 0.2),
          ]
        : [lightenColor(rawMeshColors[0], 0.28), ...rawMeshColors];

  // Positions: gold = 7 ellipses (extra highlight coverage); quicksilver = 4. Ellipses cover whole card.
  const half = MESH_ELLIPSE_SIZE / 2;
  const meshPositions =
    meshType === 'gold'
      ? [
          { top: -half - 140, left: -half - 140 },
          { top: -half - 60, left: -half - 60 },
          { top: -half - 40, left: SCREEN_W - half + 40 },
          { top: 20, left: 20 },
          { top: 60, left: SCREEN_W / 2 - half + 40 },
          { top: SHEET_H / 2 - half, left: SCREEN_W / 2 - half },
          { top: SHEET_H - half - 20, left: 80 },
          { top: SHEET_H - half + 120, left: SCREEN_W - half + 120 },
        ]
      : meshType === 'quicksilver'
        ? [
            { top: -half - 120, left: -half - 120 },
            { top: -half - 80, left: -half - 80 },
            { top: SHEET_H / 2 - half, left: SCREEN_W / 2 - half },
            { top: SHEET_H - half + 120, left: SCREEN_W - half + 120 },
          ]
        : [
          { top: -half - 100, left: -half - 100 },
          { top: SHEET_H / 2 - half - 40, left: SCREEN_W / 2 - half + 40 },
          { top: -half + 60, left: SCREEN_W - half + 60 },
          { top: SHEET_H - half + 80, left: -half + 80 },
          { top: SHEET_H - half + 100, left: SCREEN_W - half + 100 },
        ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnimation}>
      <Animated.View style={[styles.backdrop, backdropAnimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetAnimStyle]}>
        <View style={styles.meshContainer} pointerEvents="none">
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: meshType === 'gold' ? '#25211b' : meshType === 'quicksilver' ? '#1c1d1f' : '#1a1a1a' }]} />
          <Svg style={StyleSheet.absoluteFillObject}>
            <Defs>
              {meshPositions.map((_pos, i) => (
                <RadialGradient key={`g${i}`} id={`mesh${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={rawMeshColors[i % rawMeshColors.length]} stopOpacity={isLightMesh ? 0.55 : 0.2} />
                  <Stop offset="70%" stopColor={rawMeshColors[i % rawMeshColors.length]} stopOpacity={isLightMesh ? 0.25 : 0.08} />
                  <Stop offset="100%" stopColor={rawMeshColors[i % rawMeshColors.length]} stopOpacity={0} />
                </RadialGradient>
              ))}
            </Defs>
            {meshPositions.map((pos, i) => (
              <Circle
                key={i}
                cx={pos.left + MESH_ELLIPSE_SIZE / 2}
                cy={pos.top + MESH_ELLIPSE_SIZE / 2}
                r={MESH_ELLIPSE_SIZE / 2}
                fill={`url(#mesh${i})`}
              />
            ))}
          </Svg>
        </View>

        <View style={[styles.sheetInner, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <GestureDetector gesture={panGesture}>
            <View style={styles.headerDragZone}>
              <View style={styles.grabber} />
              <View style={styles.headerRow}>
                {isTop100 ? (
                  <Image
                    source={require('../assets/badge_top_100.png')}
                    style={styles.tierBadgeImage}
                    resizeMode="contain"
                  />
                ) : addMealTitleBrand.trim() ? (
                  <View style={styles.tierPill}>
                    <Text style={styles.tierPillText}>{addMealTitleBrand.trim()}</Text>
                  </View>
                ) : <View />}
                <Pressable
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                  onPress={closeWithAnimation}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color={Colors.white} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Food name — top of card, left-aligned */}
            <Text style={styles.foodNameWhite}>{displayName}</Text>

            {/* Calories + P/C/F — 4-column grid, value above label, left-aligned */}
            <View style={styles.statsGrid}>
              {[
                { value: calories || '—', label: 'cal' },
                { value: hasSelectedFood ? (protein ? `${protein}g` : '—') : null, label: 'protein' },
                { value: hasSelectedFood ? (carbs ? `${carbs}g` : '—') : null, label: 'carbs' },
                { value: hasSelectedFood ? (fat ? `${fat}g` : '—') : null, label: 'fat' },
              ].filter(item => item.value !== null).map((item, i) => (
                <View key={i} style={styles.statsCell}>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

          </ScrollView>

          {/* Quantity + serving row — outside scroll so it aligns with the button row */}
          <View style={styles.quantitySection}>
            <View style={styles.quantityLabelRow}>
              <View style={{ width: 72 }}>
                <Text style={styles.quantityFieldLabel}>quantity</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quantityFieldLabel}>serving</Text>
              </View>
            </View>
            <View style={styles.unitAmountRowCentered}>
              <View style={styles.gradientBorderWrap}>
                <View style={styles.gradientBorderInner}>
                  <Input
                    value={addMealAmount}
                    onChangeText={setAddMealAmount}
                    keyboardType="numeric"
                    placeholder="1"
                    containerStyle={styles.amountContainer}
                    style={styles.amountInput}
                  />
                </View>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setUnitDropdownOpen(true);
                }}
              >
                {({ pressed }) => (
                  <View style={[styles.gradientBorderWrapUnit, pressed && styles.unitDropdownTriggerPressed]}>
                    <View style={styles.gradientBorderInnerUnit}>
                      <Text style={styles.unitDropdownLabel}>{unitDisplayLabel(addMealUnit)}</Text>
                      <Ionicons name="chevron-down" size={16} color={Colors.white} />
                    </View>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          <View style={[styles.stickyButtonWrap, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
            <View style={styles.bottomButtonRow}>
              <Pressable
                style={({ pressed }) => [styles.brandButton, pressed && styles.brandButtonPressed]}
                onPress={onSubmit}
              >
                <LinearGradient
                  colors={['#FFFFFF', 'rgba(255,255,255,0.55)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.brandButtonGradient}
                >
                  <Text style={styles.brandButtonText}>add to {MEAL_TYPE_LABELS[mealType]}.</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.circleBtn, pressed && styles.circleBtnPressed]}
                onPress={closeWithAnimation}
              >
                <LinearGradient
                  colors={['#FFFFFF', 'rgba(255,255,255,0.55)']}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={styles.circleBtnGradient}
                >
                  <ArrowDown size={20} color={Colors.primaryDark} weight="bold" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Unit dropdown modal */}
      <Modal visible={unitDropdownOpen} transparent animationType="fade">
        <Pressable style={styles.unitDropdownBackdrop} onPress={() => setUnitDropdownOpen(false)}>
          <Pressable style={styles.unitDropdownCard} onPress={() => {}}>
            {ADD_MEAL_UNITS.map((u) => (
              <Pressable
                key={u}
                style={({ pressed }) => [styles.unitDropdownItem, pressed && styles.unitDropdownItemPressed]}
                onPress={() => {
                  setAddMealUnit(u);
                  setUnitDropdownOpen(false);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.unitDropdownItemText, addMealUnit === u && styles.unitDropdownItemTextSelected]}>{unitDisplayLabel(u)}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_H,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: Colors.primaryDark,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    zIndex: 10,
  },
  meshContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 38,
    overflow: 'hidden',
  },
  meshEllipsesWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  meshEllipse: {
    position: 'absolute',
    width: MESH_ELLIPSE_SIZE,
    height: MESH_ELLIPSE_SIZE,
    borderRadius: 999,
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
  headerTitle: {
    fontSize: Typography.h2,
    fontWeight: '600',
    letterSpacing: -0.11,
    color: Colors.white,
  },
  tierPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tierBadgeImage: {
    height: 24,
    width: 80,
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
    opacity: 0.7,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginBottom: Spacing.md,
  },
  statsCell: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.white,
    lineHeight: 30,
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.white,
    opacity: 0.55,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  foodNameWhite: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    color: '#FFFFFF',
    textAlign: 'left',
    marginBottom: Spacing.md,
    textShadowColor: 'transparent',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },
  quantitySection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  quantityLabelRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  quantityFieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  unitAmountRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'stretch',
    marginBottom: 0,
  },
  gradientBorderWrap: {
    width: 72,
    height: 44,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  gradientBorderOuter: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  gradientBorderInner: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientBorderWrapUnit: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  gradientBorderOuterUnit: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  gradientBorderInnerUnit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    margin: 1,
    paddingHorizontal: 10,
    minHeight: 38,
    borderRadius: 15,
    backgroundColor: 'transparent',
  },
  bottomButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandButton: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  brandButtonPressed: {
    opacity: 0.85,
  },
  brandButtonGradient: {
    paddingVertical: 10,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtn: {
    width: 50,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
  },
  circleBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnPressed: {
    opacity: 0.75,
  },
  brandButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.primaryDark,
    textAlign: 'center',
  },
  amountContainer: {
    marginBottom: 0,
  },
  amountInput: {
    textAlign: 'center',
    minHeight: 30,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  unitDropdownTriggerPressed: {
    opacity: 0.9,
  },
  unitDropdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  manualMacros: {
    alignSelf: 'stretch',
    marginBottom: Spacing.lg,
  },
  manualInput: {
    marginBottom: Spacing.sm,
  },
  manualInputText: {
    fontSize: Typography.dataValue,
    minHeight: 48,
    color: Colors.white,
  },
  manualMacrosRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  manualInputFlex: {
    flex: 1,
    marginBottom: 0,
  },
  stickyButtonWrap: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    alignSelf: 'stretch',
  },
  unitDropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  unitDropdownCard: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    minWidth: 200,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  unitDropdownItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  unitDropdownItemPressed: {
    backgroundColor: Colors.primaryDarkLighter,
  },
  unitDropdownItemText: {
    fontSize: Typography.body,
    color: Colors.white,
  },
  unitDropdownItemTextSelected: {
    fontWeight: '600',
  },
});
