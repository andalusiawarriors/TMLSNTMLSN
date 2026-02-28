// ============================================================
// TMLSN — AddMealSheet
// Half-screen bottom sheet for logging a food (quantity, unit, meal type).
// Hierarchy: header → title (one line) → meal type pill → calories + P/C/F → quantity/unit → Add Meal (sticky).
// ============================================================

import React, { useEffect, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Input } from './Input';
import { ADD_MEAL_UNITS, UNIT_TO_GRAMS, type AddMealUnit } from './UnitWheelPicker';
import * as Theme from '../constants/theme';
import type { MealType } from '../types';
import type { ParsedNutrition } from '../utils/foodApi';
import * as Haptics from 'expo-haptics';

const { Colors, Typography, Spacing, BorderRadius } = Theme;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SHEET_SLOT = Math.round(SCREEN_H * 0.52) - 48;
const SHEET_H = 290;
const MESH_ELLIPSE_SIZE = 800;
const CLOSED_Y = SHEET_SLOT + 40;
const OPEN_Y = 0;
const DISMISS_Y = 90;
const DISMISS_VELOCITY = 900;
const SPRING_CFG = { damping: 28, stiffness: 460, mass: 0.4 };
const CARD_R = 28;
const CARD_PAD = 24;

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

/** FDA 2020 %Daily Value reference amounts */
const DRI: Record<string, number> = {
  calories: 2000,
  totalFat: 78,
  saturatedFat: 20,
  cholesterol: 300,
  sodium: 2300,
  totalCarbs: 275,
  fiber: 28,
  sugars: 50,
  protein: 50,
  vitaminA: 900,
  vitaminC: 90,
  vitaminD: 20,
  vitaminE: 15,
  vitaminK: 120,
  thiamin: 1.2,
  riboflavin: 1.3,
  niacin: 16,
  vitaminB6: 1.7,
  folate: 400,
  vitaminB12: 2.4,
  calcium: 1300,
  iron: 18,
  potassium: 4700,
  magnesium: 420,
  phosphorus: 1250,
  zinc: 11,
  copper: 0.9,
  manganese: 2.3,
  selenium: 55,
};

function driPct(value: number, driKey: string): string | undefined {
  const ref = DRI[driKey];
  if (!ref || value === 0) return undefined;
  return `${Math.round((value / ref) * 100)}%`;
}

type NutritionRow = { key: string; label: string; value: string; dri?: string; indent?: boolean };

function buildNutritionRows(
  food: ParsedNutrition | null | undefined,
  fallback: { calories: string; protein: string; carbs: string; fat: string; hasSelectedFood: boolean },
  scalingFactor: number = 1,
): NutritionRow[] {
  const dash = '—';
  const scl = scalingFactor;

  if (!food && !fallback.hasSelectedFood) {
    return [
      { key: 'cal', label: 'calories', value: dash },
      { key: 'fat', label: 'total fat', value: dash },
      { key: 'carbs', label: 'total carbs', value: dash },
      { key: 'protein', label: 'protein', value: dash },
    ];
  }

  const calBase = food?.calories != null ? Number(food.calories) : (fallback.calories ? parseFloat(fallback.calories) : null);
  const fatBase = food?.fat ?? (fallback.fat ? Number(fallback.fat) : null);
  const carbsBase = food?.carbs ?? (fallback.carbs ? Number(fallback.carbs) : null);
  const protBase = food?.protein ?? (fallback.protein ? Number(fallback.protein) : null);
  const has = !!food;

  // Format helpers — return "—" when the scaled value is zero
  const fmtG = (v: number) => v === 0 ? dash : `${parseFloat(v.toFixed(1))}g`;
  const fmtMg = (v: number) => v === 0 ? dash : `${Math.round(v)}mg`;
  const fmtMcg = (v: number) => v === 0 ? dash : `${v.toFixed(1)}mcg`;
  const fmtMgP = (v: number) => v === 0 ? dash : `${v.toFixed(2)}mg`;

  const rows: NutritionRow[] = [];

  // Calories, protein, carbs, fat — no %DV shown
  const scaledCal = calBase != null ? Math.round(calBase * scl) : null;
  rows.push({ key: 'cal', label: 'calories', value: scaledCal != null ? (scaledCal === 0 ? dash : String(scaledCal)) : dash });

  const scaledFat = fatBase != null ? fatBase * scl : null;
  rows.push({ key: 'fat', label: 'total fat', value: scaledFat != null ? fmtG(scaledFat) : dash });
  if (has) {
    const satF = (food.saturatedFat ?? 0) * scl;
    rows.push({ key: 'satfat', label: 'saturated fat', value: fmtG(satF), dri: satF > 0 ? driPct(satF, 'saturatedFat') : undefined, indent: true });
    rows.push({ key: 'transfat', label: 'trans fat', value: fmtG((food.transFat ?? 0) * scl), indent: true });
    rows.push({ key: 'monofat', label: 'monounsaturated fat', value: fmtG((food.monounsaturatedFat ?? 0) * scl), indent: true });
    rows.push({ key: 'polyfat', label: 'polyunsaturated fat', value: fmtG((food.polyunsaturatedFat ?? 0) * scl), indent: true });
  }

  if (has) {
    const chol = (food.cholesterol ?? 0) * scl;
    rows.push({ key: 'chol', label: 'cholesterol', value: fmtMg(chol), dri: chol > 0 ? driPct(chol, 'cholesterol') : undefined });
    const sod = (food.sodium ?? 0) * scl;
    rows.push({ key: 'sodium', label: 'sodium', value: fmtMg(sod), dri: sod > 0 ? driPct(sod, 'sodium') : undefined });
  }

  const scaledCarbs = carbsBase != null ? carbsBase * scl : null;
  rows.push({ key: 'carbs', label: 'total carbs', value: scaledCarbs != null ? fmtG(scaledCarbs) : dash });
  if (has) {
    const fib = (food.fiber ?? 0) * scl;
    rows.push({ key: 'fiber', label: 'dietary fiber', value: fmtG(fib), dri: fib > 0 ? driPct(fib, 'fiber') : undefined, indent: true });
    const sug = (food.sugars ?? 0) * scl;
    rows.push({ key: 'sugars', label: 'sugars', value: fmtG(sug), dri: sug > 0 ? driPct(sug, 'sugars') : undefined, indent: true });
  }

  const scaledProt = protBase != null ? protBase * scl : null;
  rows.push({ key: 'protein', label: 'protein', value: scaledProt != null ? fmtG(scaledProt) : dash });

  if (has) {
    const vitamins: { key: string; label: string; val: number; driKey: string; isMcg?: boolean }[] = [
      { key: 'vitA', label: 'vitamin A', val: food.vitaminA ?? 0, driKey: 'vitaminA', isMcg: true },
      { key: 'vitC', label: 'vitamin C', val: food.vitaminC ?? 0, driKey: 'vitaminC' },
      { key: 'vitD', label: 'vitamin D', val: food.vitaminD ?? 0, driKey: 'vitaminD', isMcg: true },
      { key: 'vitE', label: 'vitamin E', val: food.vitaminE ?? 0, driKey: 'vitaminE' },
      { key: 'vitK', label: 'vitamin K', val: food.vitaminK ?? 0, driKey: 'vitaminK', isMcg: true },
      { key: 'b1', label: 'thiamin (B1)', val: food.thiamin ?? 0, driKey: 'thiamin' },
      { key: 'b2', label: 'riboflavin (B2)', val: food.riboflavin ?? 0, driKey: 'riboflavin' },
      { key: 'b3', label: 'niacin (B3)', val: food.niacin ?? 0, driKey: 'niacin' },
      { key: 'b6', label: 'vitamin B6', val: food.vitaminB6 ?? 0, driKey: 'vitaminB6' },
      { key: 'b9', label: 'folate (B9)', val: food.folate ?? 0, driKey: 'folate', isMcg: true },
      { key: 'b12', label: 'vitamin B12', val: food.vitaminB12 ?? 0, driKey: 'vitaminB12', isMcg: true },
    ];
    for (const v of vitamins) {
      const scaled = v.val * scl;
      rows.push({ key: v.key, label: v.label, value: v.isMcg ? fmtMcg(scaled) : fmtMgP(scaled), dri: scaled > 0 ? driPct(scaled, v.driKey) : undefined });
    }
  }

  if (has) {
    const minerals: { key: string; label: string; val: number; driKey: string; isMcg?: boolean }[] = [
      { key: 'calcium', label: 'calcium', val: food.calcium ?? 0, driKey: 'calcium' },
      { key: 'iron', label: 'iron', val: food.iron ?? 0, driKey: 'iron' },
      { key: 'potassium', label: 'potassium', val: food.potassium ?? 0, driKey: 'potassium' },
      { key: 'magnesium', label: 'magnesium', val: food.magnesium ?? 0, driKey: 'magnesium' },
      { key: 'phosphorus', label: 'phosphorus', val: food.phosphorus ?? 0, driKey: 'phosphorus' },
      { key: 'zinc', label: 'zinc', val: food.zinc ?? 0, driKey: 'zinc' },
      { key: 'copper', label: 'copper', val: food.copper ?? 0, driKey: 'copper' },
      { key: 'manganese', label: 'manganese', val: food.manganese ?? 0, driKey: 'manganese' },
      { key: 'selenium', label: 'selenium', val: food.selenium ?? 0, driKey: 'selenium', isMcg: true },
    ];
    for (const m of minerals) {
      const scaled = m.val * scl;
      rows.push({ key: m.key, label: m.label, value: m.isMcg ? fmtMcg(scaled) : fmtMg(scaled), dri: scaled > 0 ? driPct(scaled, m.driKey) : undefined });
    }
  }

  return rows;
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
  selectedFood?: ParsedNutrition | null;
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
  selectedFood,
}: AddMealSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(CLOSED_Y);
  const backdropOpacity = useSharedValue(0);
  const isExpanded = useSharedValue(0);
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const expandedTranslateYSV = useSharedValue(-(SCREEN_H - SHEET_SLOT - (insets.top || 44) - 10));

  useEffect(() => {
    expandedTranslateYSV.value = -(SCREEN_H - SHEET_SLOT - insets.top - 10);
  }, [insets.top, expandedTranslateYSV]);

  const closeWithAnimation = () => {
    isExpanded.value = 0;
    setScrollEnabled(false);
    backdropOpacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(CLOSED_Y, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const etY = expandedTranslateYSV.value;
      if (isExpanded.value === 1) {
        if (e.translationY > 0) {
          translateY.value = etY + e.translationY;
        }
      } else {
        translateY.value = Math.max(etY, e.translationY);
      }
    })
    .onEnd((e) => {
      const etY = expandedTranslateYSV.value;
      if (isExpanded.value === 0) {
        if (e.translationY < -40 || e.velocityY < -500) {
          isExpanded.value = 1;
          runOnJS(setScrollEnabled)(true);
          translateY.value = withSpring(etY, SPRING_CFG);
        } else if (e.translationY > DISMISS_Y || e.velocityY > DISMISS_VELOCITY) {
          runOnJS(closeWithAnimation)();
        } else {
          translateY.value = withSpring(0, SPRING_CFG);
        }
      } else {
        if (e.translationY > DISMISS_Y || e.velocityY > DISMISS_VELOCITY) {
          isExpanded.value = 0;
          runOnJS(setScrollEnabled)(false);
          translateY.value = withSpring(0, SPRING_CFG);
        } else {
          translateY.value = withSpring(etY, SPRING_CFG);
        }
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
      isExpanded.value = 0;
      setScrollEnabled(false);
      translateY.value = withTiming(OPEN_Y, { duration: 220, easing: Easing.out(Easing.cubic) });
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.ease) });
    } else {
      isExpanded.value = 0;
      setScrollEnabled(false);
      translateY.value = CLOSED_Y;
      backdropOpacity.value = 0;
    }
  }, [visible, translateY, backdropOpacity, isExpanded]);

  const isTop100 = addMealTitleBrand.trim().toUpperCase() === 'TMLSN TOP 100';
  const isVerified = addMealTitleBrand.trim().toUpperCase() === 'TMLSN VERIFIED';
  const displayName = mealName.trim() || 'add meal';

  // Mesh type: gold (Top 100), quicksilver (Verified), neutral (plain)
  // Gold/quicksilver: raw gradient + extra "peak highlight" ellipse (lightened first color) so blur result matches the linear gradient's highlight.
  const meshType = isTop100 ? 'gold' : isVerified ? 'quicksilver' : 'neutral';
  const rawMeshColors = meshType === 'gold' ? champagneGradient : meshType === 'quicksilver' ? quicksilverGradient : [Colors.primaryDark, Colors.primaryDarkLighter];
  const isLightMesh = meshType === 'gold' || meshType === 'quicksilver';
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const dropdownProgress = useSharedValue(0);

  const openDropdown = () => {
    setUnitDropdownOpen(true);
    dropdownProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
  };
  const closeDropdown = () => {
    dropdownProgress.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setUnitDropdownOpen)(false);
    });
  };
  const dropdownAnimStyle = useAnimatedStyle(() => ({
    opacity: dropdownProgress.value,
    transform: [
      { scale: 0.92 + dropdownProgress.value * 0.08 },
      { translateY: (1 - dropdownProgress.value) * 6 },
    ],
  }));

  // Scaling factor: all USDA nutrient values are per 100g. Scale to the user's chosen qty × unit.
  const scalingFactor = (parseFloat(addMealAmount) || 1) * UNIT_TO_GRAMS[addMealUnit] / 100;
  const scaledCal = calories ? String(Math.round(parseFloat(calories) * scalingFactor)) : '—';
  const scaledProtein = hasSelectedFood && protein ? `${(parseFloat(protein) * scalingFactor).toFixed(1)}g` : '—';
  const scaledCarbs = hasSelectedFood && carbs ? `${(parseFloat(carbs) * scalingFactor).toFixed(1)}g` : '—';
  const scaledFat = hasSelectedFood && fat ? `${(parseFloat(fat) * scalingFactor).toFixed(1)}g` : '—';

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

        {/* Nutrition ScrollView — fills the full sheet, content starts below the gold card
            via paddingTop: SHEET_H. When expanded, user can scroll this independently. */}
        <ScrollView
          style={styles.nutritionScroll}
          contentContainerStyle={styles.nutritionScrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
          bounces={false}
        >
          <Text style={styles.nutritionDataHeading}>nutritional data</Text>
          <View style={styles.nutritionDataCard}>
            {buildNutritionRows(selectedFood, { calories, protein, carbs, fat, hasSelectedFood }, scalingFactor).map((row, i, arr) => (
              <View key={row.key} style={[styles.nutritionRow, row.indent && styles.nutritionRowIndent, i < arr.length - 1 && styles.nutritionRowBorder]}>
                <Text style={[styles.nutritionRowLabel, row.indent && styles.nutritionRowLabelSub]}>{row.label}</Text>
                <View style={styles.nutritionRowRight}>
                  <Text style={styles.nutritionRowValue}>{row.value}</Text>
                  {row.dri ? <Text style={styles.nutritionRowDri}>{row.dri} DV</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Gold card — absolutely positioned on top (zIndex:2) so nutrition scrolls behind it */}
        <View style={styles.cardZone}>
          <LinearGradient
            colors={['#D4B896', '#A8895E']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.meshContainer}
          />

          <View style={styles.sheetInner}>
            {/* Grabber — GestureDetector only here to avoid conflicts with Pressables below */}
            <GestureDetector gesture={panGesture}>
              <View style={styles.headerDragZone}>
                <View style={styles.grabber} />
              </View>
            </GestureDetector>

            {/* Badge */}
            <View style={styles.badgeRow}>
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
              ) : null}
            </View>

            {/* Food name */}
            <Text style={styles.foodNameWhite}>{displayName}</Text>

            {/* 4 nutrition pills */}
            <View style={styles.statsGrid}>
              {[
                { value: scaledCal, label: 'calories' },
                { value: scaledProtein, label: 'protein' },
                { value: scaledCarbs, label: 'carbs' },
                { value: scaledFat, label: 'fat' },
              ].map((item, i) => (
                <View key={i} style={styles.statsPill}>
                  <Text style={styles.statValue}>{item.value}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Combined quantity + unit capsule */}
            <View style={styles.capsuleOuter}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', '#D4B896']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.capsuleBorderCutout} />
              <View style={styles.capsule}>
                <View style={styles.capsuleLeft}>
                  <Input
                    value={addMealAmount}
                    onChangeText={setAddMealAmount}
                    keyboardType="numeric"
                    placeholder="1"
                    containerStyle={styles.capsuleInputContainer}
                    style={styles.capsuleInputText}
                  />
                </View>
                <View style={styles.capsuleDivider} />
                <Pressable
                  style={styles.capsuleRight}
                  onPress={() => {
                    Haptics.selectionAsync();
                    openDropdown();
                  }}
                >
                  <Text style={styles.capsuleUnitLabel}>{unitDisplayLabel(addMealUnit)}</Text>
                  <Ionicons name="chevron-up" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            {/* Add to meal button */}
            <View style={styles.addButtonWrap}>
              <Pressable
                style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                onPress={onSubmit}
              >
                <MaskedView
                  maskElement={
                    <Text style={styles.addButtonText}>add to {MEAL_TYPE_LABELS[mealType]}</Text>
                  }
                >
                  <LinearGradient
                    colors={['#D4B896', '#A8895E']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                  >
                    <Text style={[styles.addButtonText, { opacity: 0 }]}>add to {MEAL_TYPE_LABELS[mealType]}</Text>
                  </LinearGradient>
                </MaskedView>
              </Pressable>
            </View>
          </View>
        </View>

      </Animated.View>

      {unitDropdownOpen && (
        <>
          <Pressable style={styles.unitDropdownBackdrop} onPress={closeDropdown} />
          <Animated.View style={[styles.unitDropdownPopup, dropdownAnimStyle]}>
            {ADD_MEAL_UNITS.map((u) => (
              <Pressable
                key={u}
                style={({ pressed }) => [styles.unitDropdownItem, pressed && styles.unitDropdownItemPressed]}
                onPress={() => {
                  setAddMealUnit(u);
                  closeDropdown();
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.unitDropdownItemText, addMealUnit === u && styles.unitDropdownItemTextSelected]}>{unitDisplayLabel(u)}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </>
      )}
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
    top: SCREEN_H - SHEET_SLOT,
    height: SCREEN_H,
    backgroundColor: '#2F3031',
    overflow: 'hidden',
    borderTopLeftRadius: CARD_R,
    borderTopRightRadius: CARD_R,
    zIndex: 10,
  },
  cardZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    overflow: 'hidden',
    borderRadius: CARD_R,
    zIndex: 2,
  },
  meshContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_R,
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
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 8,
  },
  badgeRow: {
    paddingHorizontal: CARD_PAD,
    marginBottom: -2,
  },
  tierBadgeImage: {
    height: 19,
    width: 64,
  },
  tierPill: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: '#FFFFFF',
    opacity: 0.7,
    textTransform: 'uppercase',
  },
  foodNameWhite: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -1.3,
    lineHeight: 32,
    color: '#FFFFFF',
    paddingHorizontal: CARD_PAD,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    marginBottom: 20,
  },
  statsPill: {
    width: 72,
    height: 51,
    borderRadius: 12,
    backgroundColor: '#D4B896',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -1.0,
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  capsuleOuter: {
    height: 32,
    width: 162,
    borderRadius: 12,
    alignSelf: 'center',
    marginBottom: 22,
    overflow: 'hidden',
  },
  capsuleBorderCutout: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 11,
    backgroundColor: '#D4B896',
  },
  capsule: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  capsuleLeft: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleDivider: {
    width: 1.8,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  capsuleRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  capsuleInputContainer: {
    marginBottom: 0,
  },
  capsuleInputText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.8,
    color: '#FFFFFF',
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
    paddingVertical: 0,
    minHeight: 30,
  },
  capsuleUnitLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.8,
    color: '#FFFFFF',
  },
  addButtonWrap: {
    paddingHorizontal: CARD_PAD,
  },
  addButton: {
    width: 341,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  addButtonPressed: {
    opacity: 0.85,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.9,
    color: '#000000',
  },
  unitDropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  unitDropdownPopup: {
    position: 'absolute',
    top: SHEET_H - 98,
    alignSelf: 'center',
    width: 170,
    backgroundColor: '#2F3031',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 51,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 16,
    overflow: 'hidden',
  },
  unitDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  unitDropdownItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  unitDropdownItemText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: -0.3,
  },
  unitDropdownItemTextSelected: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nutritionScroll: {
    flex: 1,
    zIndex: 1,
  },
  nutritionScrollContent: {
    paddingTop: SHEET_H + Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl + 40,
  },
  nutritionDataHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: Spacing.md,
  },
  nutritionDataCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  nutritionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  nutritionRowIndent: {
    paddingLeft: Spacing.md + 16,
  },
  nutritionRowLabelSub: {
    color: 'rgba(255,255,255,0.5)',
  },
  nutritionRowLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.white,
  },
  nutritionRowRight: {
    alignItems: 'flex-end',
  },
  nutritionRowValue: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  nutritionRowDri: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.35)',
    marginTop: 1,
  },
});
