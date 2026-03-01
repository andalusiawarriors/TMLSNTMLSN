// ============================================================
// TMLSN — AddMealSheet
// Half-screen bottom sheet for logging a food (quantity, unit, meal type).
// Hierarchy: header → title (one line) → meal type pill → calories + P/C/F → quantity/unit → Add Meal (sticky).
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { Gesture, GestureDetector, NativeViewGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { ADD_MEAL_UNITS, UNIT_TO_GRAMS, resolveGrams, type AddMealUnit } from '../utils/unitGrams';
import * as Theme from '../constants/theme';
import type { MealType } from '../types';
import type { ParsedNutrition } from '../utils/foodApi';
import * as Haptics from 'expo-haptics';

const { Colors, Typography, Spacing, BorderRadius } = Theme;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CF_W = 72;
const CF_MS = 350;
const CF_BLUR = 8;

function CrossfadeText({ value, textStyle }: { value: string; pillBg?: string; textStyle?: any; style?: any }) {
  const [slotA, setSlotA] = React.useState(value);
  const [slotB, setSlotB] = React.useState(value);
  const progress = useSharedValue(0);
  const activeSlot = React.useRef<0 | 1>(0);
  const prevRef = React.useRef(value);
  const rafId = React.useRef<number>();

  React.useEffect(() => {
    if (value === prevRef.current) return;
    prevRef.current = value;
    cancelAnimation(progress);
    if (rafId.current != null) cancelAnimationFrame(rafId.current);

    const target: 0 | 1 = activeSlot.current === 0 ? 1 : 0;
    if (target === 1) setSlotB(value);
    else setSlotA(value);

    rafId.current = requestAnimationFrame(() => {
      activeSlot.current = target;
      progress.value = withTiming(target, {
        duration: CF_MS,
        easing: Easing.inOut(Easing.cubic),
      });
    });
  }, [value]);

  React.useEffect(() => () => {
    if (rafId.current != null) cancelAnimationFrame(rafId.current);
  }, []);

  const styleA = useAnimatedStyle(() => ({
    opacity: Math.cos(progress.value * Math.PI / 2),
  }));
  const styleB = useAnimatedStyle(() => ({
    opacity: Math.sin(progress.value * Math.PI / 2),
  }));

  return (
    <View style={{ width: CF_W, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Text style={[textStyle, styleA, { position: 'absolute', textAlign: 'center', width: CF_W }]}>
        {slotA}
      </Animated.Text>
      <Animated.Text style={[textStyle, styleB, { position: 'absolute', textAlign: 'center', width: CF_W }]}>
        {slotB}
      </Animated.Text>
    </View>
  );
}

const SHEET_SLOT = Math.round(SCREEN_H * 0.52) - 48;
const SHEET_H = 284;
const MESH_ELLIPSE_SIZE = 800;
const CLOSED_Y = SHEET_SLOT + 40;
const OPEN_Y = 0;
const DISMISS_Y = 90;
const DISMISS_VELOCITY = 900;
const SPRING_CFG = { damping: 28, stiffness: 460, mass: 0.4 };
const CARD_R = 28;
const CARD_PAD = 24;
const PILLS_ROW_W = 4 * 72 + 3 * 18; // 342 — total width of the 4 stat pills + gaps
const PILLS_H_PAD = (SCREEN_W - PILLS_ROW_W) / 2;
// Food name width: slightly narrower than pill row so text+fade end at fat pill edge (fade visually extends past clip)
const FOOD_NAME_W = PILLS_ROW_W - 10;
const MARQUEE_FADE_W = 40;
const MARQUEE_IDLE_MS = 2000;
const MARQUEE_SPEED = 28;
const MARQUEE_PAUSE_AT_END_MS = 1200;  // pause when end of text reaches right edge of fat pill
const MARQUEE_PAUSE_AT_START_MS = 1800; // pause at start before next cycle

const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
};

const STATIC_UNIT_LABELS: Record<AddMealUnit, string> = {
  tbsp: 'tbsp',
  tsp: 'tsp',
  cup: '1 cup',
  '2cup': '2 cups',
  halfCup: '½ cup',
  quarterCup: '¼ cup',
  '100g': '100g',
  '1g': '1g',
  ml: 'ml',
  '100ml': '100ml',
  oz: 'oz',
};

function unitDisplayLabel(u: string): string {
  if (u in STATIC_UNIT_LABELS) return STATIC_UNIT_LABELS[u as AddMealUnit];
  return u;
}

const COMPACT_UNIT_LABELS: Partial<Record<AddMealUnit, string>> = {
  '2cup': '2 cup',
};

function unitCompactLabel(u: string): string {
  if (u in COMPACT_UNIT_LABELS) return COMPACT_UNIT_LABELS[u as AddMealUnit]!;
  return unitDisplayLabel(u);
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
    const st = (food.starch ?? 0) * scl;
    rows.push({ key: 'starch', label: 'starch', value: fmtG(st), indent: true });
    const added = (food.addedSugars ?? 0) * scl;
    rows.push({ key: 'addedSugars', label: 'added sugars', value: fmtG(added), indent: true });
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
  addMealUnit: string;
  setAddMealUnit: (u: string) => void;
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
  userVolumeUnit?: 'oz' | 'ml';
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
  userVolumeUnit,
}: AddMealSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(CLOSED_Y);
  const backdropOpacity = useSharedValue(0);
  const isExpanded = useSharedValue(0);
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const scrollOffsetSV = useSharedValue(0);
  const gestureStartedAtTopSV = useSharedValue(0);
  const collapsingFromTopSV = useSharedValue(0);
  const nativeScrollRef = useRef<NativeViewGestureHandler>(null);
  const quantityInputRef = useRef<TextInput>(null);
  const expandedTranslateYSV = useSharedValue(-(SCREEN_H - SHEET_SLOT - (insets.top || 44) - 10));

  useEffect(() => {
    expandedTranslateYSV.value = -(SCREEN_H - SHEET_SLOT - insets.top - 10);
  }, [insets.top, expandedTranslateYSV]);

  useEffect(() => {
    if (visible) {
      setUnitDropdownOpen(false);
      dropdownProgress.value = 0;
    }
  }, [visible]);

  const closeWithAnimation = () => {
    if (unitDropdownOpen) {
      setUnitDropdownOpen(false);
      dropdownProgress.value = 0;
    }
    isExpanded.value = 0;
    setScrollEnabled(false);
    backdropOpacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(CLOSED_Y, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  // Single gesture covering the entire sheet. In semi-opened state it moves the
  // whole sheet (card + nutrition area as one block). In expanded state it only
  // moves the sheet when the touch started at scroll offset 0 and drags down;
  // all other expanded-state drags fall through to the ScrollView via
  // simultaneousWithExternalGesture.
  const sheetGesture = Gesture.Pan()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .simultaneousWithExternalGesture(nativeScrollRef as React.RefObject<React.ComponentType<{}>>)
    .activeOffsetY([-10, 10])
    .onBegin(() => {
      gestureStartedAtTopSV.value = scrollOffsetSV.value <= 2 ? 1 : 0;
      collapsingFromTopSV.value = 0;
    })
    .onUpdate((e) => {
      const etY = expandedTranslateYSV.value;
      if (isExpanded.value === 0) {
        // Semi-opened: whole sheet moves as one block in any direction
        translateY.value = Math.max(etY, e.translationY);
      } else if (gestureStartedAtTopSV.value === 1 && e.translationY > 0) {
        // Expanded + touch started at top + dragging down.
        // Disable the ScrollView on the very first down-frame so both card and
        // nutrition content lock together and move at exactly the same speed.
        if (collapsingFromTopSV.value === 0) {
          collapsingFromTopSV.value = 1;
          runOnJS(setScrollEnabled)(false);
        }
        translateY.value = etY + e.translationY;
      }
      // Expanded + not at top, or dragging up → do nothing, ScrollView handles it
    })
    .onEnd((e) => {
      const etY = expandedTranslateYSV.value;
      if (isExpanded.value === 0) {
        if (e.translationY < -40 || e.velocityY < -500) {
          isExpanded.value = 1;
          runOnJS(setScrollEnabled)(true);
          translateY.value = withTiming(etY, { duration: 260, easing: Easing.out(Easing.cubic) });
        } else if (e.translationY > DISMISS_Y || e.velocityY > DISMISS_VELOCITY) {
          runOnJS(closeWithAnimation)();
        } else {
          translateY.value = withSpring(0, SPRING_CFG);
        }
      } else {
        if (gestureStartedAtTopSV.value === 1 && (e.translationY > DISMISS_Y || e.velocityY > DISMISS_VELOCITY)) {
          isExpanded.value = 0;
          // scrollEnabled already false (set in onUpdate)
          translateY.value = withSpring(0, SPRING_CFG);
        } else if (gestureStartedAtTopSV.value === 1) {
          // Partial drag from top that didn't reach threshold — snap back, re-enable scroll
          runOnJS(setScrollEnabled)(true);
          translateY.value = withSpring(etY, SPRING_CFG);
        }
        // else: gesture ran while scrolling in list — sheet untouched, scroll stays enabled
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
  const handleAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (cleaned === '' || /^\d{0,3}(\.\d{0,2})?$/.test(cleaned)) {
      if (cleaned !== '' && selectedFood) {
        const amt = parseFloat(cleaned);
        if (Number.isFinite(amt) && amt > 0) {
          const grams = amt * resolveGrams(addMealUnit, selectedFood.portions);
          const scale = grams / 100;
          const cal = Math.round((selectedFood.calories || 0) * scale);
          const p = (selectedFood.protein || 0) * scale;
          const c = (selectedFood.carbs || 0) * scale;
          const f = (selectedFood.fat || 0) * scale;
          if (cal > 9999 || p > 999.9 || c > 999.9 || f > 999.9) return;
        }
      }
      setAddMealAmount(cleaned);
    }
  }, [setAddMealAmount, addMealUnit, selectedFood]);

  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [capsuleBottomInSheet, setCapsuleBottomInSheet] = useState(0);
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
      { translateY: (1 - dropdownProgress.value) * -6 },
    ],
  }));
  const dividerAnimStyle = useAnimatedStyle(() => ({
    opacity: 1 - dropdownProgress.value,
  }));

  // --- Marquee (auto-scrolling food name) ---
  const [nameOverflow, setNameOverflow] = useState(0);
  const marqueeX = useSharedValue(0);
  const marqueeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameMeasure = useCallback((e: any) => {
    const lines = e.nativeEvent?.lines;
    const w = lines?.length ? lines[0].width : e.nativeEvent.layout?.width ?? 0;
    const overflow = Math.max(0, w - FOOD_NAME_W);
    setNameOverflow((prev) => (Math.abs(prev - overflow) > 1 ? overflow : prev));
  }, []);

  useEffect(() => {
    setNameOverflow(0);
    cancelAnimation(marqueeX);
    marqueeX.value = 0;
  }, [displayName, marqueeX]);

  useEffect(() => {
    if (marqueeTimerRef.current) clearTimeout(marqueeTimerRef.current);
    cancelAnimation(marqueeX);
    marqueeX.value = 0;

    if (nameOverflow > 0 && visible) {
      // Scroll exactly nameOverflow px left so the end of the text aligns with the right edge of the fat pill
      const scrollOutDur = Math.max(nameOverflow * MARQUEE_SPEED, 1500);
      const scrollBackDur = scrollOutDur; // same speed for revert
      marqueeTimerRef.current = setTimeout(() => {
        marqueeX.value = withRepeat(
          withSequence(
            // 1. Scroll left until the rest of the text lies at the right edge of the fat pill, then stop
            withTiming(-nameOverflow, { duration: scrollOutDur, easing: Easing.linear }),
            // 2. Pause at the end position
            withDelay(MARQUEE_PAUSE_AT_END_MS, withTiming(-nameOverflow, { duration: 1 })),
            // 3. Revert: smooth scroll back to show the beginning characters
            withTiming(0, { duration: scrollBackDur, easing: Easing.linear }),
            // 4. Pause at start before next cycle
            withDelay(MARQUEE_PAUSE_AT_START_MS, withTiming(0, { duration: 1 })),
          ),
          -1,
        );
      }, MARQUEE_IDLE_MS);
    }

    return () => {
      if (marqueeTimerRef.current) clearTimeout(marqueeTimerRef.current);
    };
  }, [nameOverflow, visible, marqueeX]);

  const marqueeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: marqueeX.value }],
  }));

  const foodPortions = selectedFood?.portions;
  const baseUnits = userVolumeUnit === 'ml'
    ? ([...ADD_MEAL_UNITS.filter(u => u !== 'oz'), 'oz'] as string[])
    : ([...ADD_MEAL_UNITS] as string[]);
  const allUnits: string[] = [
    ...(foodPortions?.map(p => p.label) ?? []),
    ...baseUnits,
  ];

  // Scaling factor for the nutrition data table (raw per-100g values from selectedFood).
  const scalingFactor = (parseFloat(addMealAmount) || 1) * resolveGrams(addMealUnit, foodPortions) / 100;

  // Pills: calories/protein/carbs/fat props are already scaled by the parent, display directly.
  const amt = parseFloat(addMealAmount);
  const hasAmt = Number.isFinite(amt) && amt > 0;
  const scaledCal = hasAmt && calories ? String(Math.round(parseFloat(calories))) : '0';
  const scaledProtein = hasAmt && protein ? `${parseFloat(protein).toFixed(1)}g` : '0g';
  const scaledCarbs = hasAmt && carbs ? `${parseFloat(carbs).toFixed(1)}g` : '0g';
  const scaledFat = hasAmt && fat ? `${parseFloat(fat).toFixed(1)}g` : '0g';

  const cardGradient: [string, string] =
    meshType === 'gold' ? ['#D4B896', '#A8895E']
    : meshType === 'quicksilver' ? ['#d6d8da', '#6b6f74']
    : ['#2F3031', '#1A1A1A'];

  const pillColor =
    meshType === 'gold' ? '#D4B896'
    : meshType === 'quicksilver' ? '#B9B9B9'
    : Colors.primaryDark;

  const toggleBorderEnd =
    meshType === 'gold' ? '#D4B896'
    : meshType === 'quicksilver' ? '#B9B9B9'
    : '#383838';

  const toggleGradientStart = meshType === 'neutral'
    ? { x: 0, y: 0 } : { x: 0, y: 0.5 };
  const toggleGradientEnd = meshType === 'neutral'
    ? { x: 1, y: 1 } : { x: 1, y: 0.5 };

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

      <GestureDetector gesture={sheetGesture}>
      <Animated.View style={[styles.sheet, sheetAnimStyle]}>

        {/* Nutrition ScrollView — fills the full sheet, content starts below the gold card
            via paddingTop: SHEET_H. When expanded, user can scroll this independently.
            NativeViewGestureHandler allows sheetGesture to run simultaneously with the
            native scroll so the whole sheet moves as one block in semi-opened state. */}
          <NativeViewGestureHandler ref={nativeScrollRef}>
            <ScrollView
              style={styles.nutritionScroll}
              contentContainerStyle={styles.nutritionScrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={scrollEnabled}
              bounces={true}
              scrollEventThrottle={16}
              onScroll={(e) => {
                scrollOffsetSV.value = e.nativeEvent.contentOffset.y;
              }}
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
          </NativeViewGestureHandler>

        {/* Gold card — absolutely positioned on top (zIndex:2) so nutrition scrolls behind it */}
        <View style={styles.cardZone}>
          <LinearGradient
            colors={cardGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.meshContainer}
          />

          <View style={styles.sheetInner}>
              <View style={styles.headerDragZone}>
                <View style={styles.grabber} />
              </View>

            {/* Badge — Top 100 / Verified image, or spacer for default (preserves title position, brand below) */}
            <View style={styles.badgeRow}>
              {isTop100 ? (
                <Image
                  source={require('../assets/badge_top_100.png')}
                  style={styles.tierBadgeImage}
                  resizeMode="contain"
                />
              ) : isVerified ? (
                <Image
                  source={require('../assets/badge_verified.png')}
                  style={styles.tierBadgeImage}
                  resizeMode="contain"
                />
              ) : addMealTitleBrand.trim() ? (
                <View style={styles.badgeRowSpacer} />
              ) : null}
            </View>

            {/* Food name — marquee scroll for long names */}
            <View style={[
              styles.foodNameOuter,
              addMealBrandName.trim() && !isTop100 && !isVerified && styles.foodNameOuterTightBottom,
            ]}>
              <View style={styles.foodNameMeasureWrap}>
                <Text style={styles.foodNameMeasureText} onTextLayout={handleNameMeasure}>
                  {displayName}
                </Text>
              </View>

              {nameOverflow > 0 ? (
                <MaskedView
                  style={styles.foodNameMask}
                  maskElement={
                    <LinearGradient
                      colors={['#000', '#000', 'transparent']}
                      locations={[0, 1 - MARQUEE_FADE_W / FOOD_NAME_W, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{ flex: 1 }}
                    />
                  }
                >
                  <Animated.View style={[styles.foodNameScrollTrack, marqueeAnimStyle]}>
                    <Text style={styles.foodNameText}>{displayName}</Text>
                  </Animated.View>
                </MaskedView>
              ) : (
                <Text style={styles.foodNameText} numberOfLines={1}>
                  {displayName}
                </Text>
              )}
            </View>

            {/* Brand name — any card with a brand (gold, silver, or default). Gold/silver use overlay style so no element moves. */}
            {addMealBrandName.trim() ? (
              <Text
                style={[
                  styles.brandNameBelow,
                  (isTop100 || isVerified) && styles.brandNameBelowOverlay,
                ]}
              >
                {addMealBrandName.trim()}
              </Text>
            ) : null}

            {/* 4 nutrition pills */}
            <View style={styles.statsGrid}>
              {[
                { value: scaledCal, label: 'calories' },
                { value: scaledProtein, label: 'protein' },
                { value: scaledCarbs, label: 'carbs' },
                { value: scaledFat, label: 'fat' },
              ].map((item, i) => (
                <View key={i} style={[styles.statsPill, { backgroundColor: pillColor }]}>
                  <CrossfadeText value={item.value} pillBg={pillColor} textStyle={styles.statValue} />
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            {/* Combined quantity + unit capsule */}
            <View
              style={styles.capsuleOuter}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                setCapsuleBottomInSheet(y + height);
              }}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', toggleBorderEnd]}
                start={toggleGradientStart}
                end={toggleGradientEnd}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={[styles.capsuleBorderCutout, { backgroundColor: pillColor }]} />
              <View style={styles.capsule}>
                <Pressable style={styles.capsuleLeft} onPress={() => quantityInputRef.current?.focus()}>
                  <TextInput
                    ref={quantityInputRef}
                    value={addMealAmount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    placeholder="1"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    style={styles.capsuleInputText}
                  />
                </Pressable>
                <Animated.View style={[styles.capsuleDivider, dividerAnimStyle]} />
                <Pressable
                  style={styles.capsuleRight}
                  onPress={() => {
                    Haptics.selectionAsync();
                    unitDropdownOpen ? closeDropdown() : openDropdown();
                  }}
                >
                  <Text style={styles.capsuleUnitLabel}>{unitCompactLabel(addMealUnit)}</Text>
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
                    colors={cardGradient}
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

        {/* Unit dropdown — lives inside the sheet so it moves with it */}
        {unitDropdownOpen && (
          <>
            <Pressable style={[StyleSheet.absoluteFill, { zIndex: 50 }]} onPress={closeDropdown} />
            <Animated.View
              style={[
                styles.dropdownShadowWrapper,
                { top: capsuleBottomInSheet - 32 },
                dropdownAnimStyle,
              ]}
            >
              {/* Ring outer — overflow:hidden clips gradient ring */}
              <View style={styles.dropdownRingOuter}>
                {/* Ring gradient (same as capsule outline, slightly stronger) */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.25)', toggleBorderEnd]}
                  start={toggleGradientStart}
                  end={toggleGradientEnd}
                  style={StyleSheet.absoluteFillObject}
                />
                {/* Inset fill+clip — 1px inside the ring, clips bg + scroll */}
                <View style={styles.dropdownInsetFill}>
                  <BlurView intensity={25} tint="default" style={StyleSheet.absoluteFillObject} />
                  <ScrollView
                    style={styles.dropdownScroll}
                    bounces={true}
                    alwaysBounceVertical={true}
                    showsVerticalScrollIndicator={false}
                  >
                    {allUnits.map((u) => (
                      <Pressable
                        key={u}
                        style={({ pressed }) => [styles.dropdownItem, pressed && styles.dropdownItemPressed]}
                        onPress={() => {
                          setAddMealUnit(u);
                          closeDropdown();
                          Haptics.selectionAsync();
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          style={[styles.dropdownItemText, addMealUnit === u && styles.dropdownItemTextSelected]}
                        >
                          {unitDisplayLabel(u)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Animated.View>
          </>
        )}

      </Animated.View>
      </GestureDetector>

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
    paddingHorizontal: PILLS_H_PAD,
    marginBottom: -2,
  },
  tierBadgeImage: {
    height: 19,
    width: 64,
  },
  badgeRowSpacer: {
    height: 20,
    width: 1,
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
  brandNameBelow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: '#FFFFFF',
    opacity: 0.7,
    textTransform: 'uppercase',
    marginLeft: PILLS_H_PAD,
    marginTop: -6,
    marginBottom: 8,
  },
  brandNameBelowOverlay: {
    marginTop: -20,
    marginBottom: 8,
  },
  foodNameOuterTightBottom: {
    marginBottom: 2,
  },
  foodNameOuter: {
    marginLeft: PILLS_H_PAD,
    width: FOOD_NAME_W,
    overflow: 'hidden',
    height: 34,
    marginBottom: 16,
  },
  foodNameMeasureWrap: {
    position: 'absolute',
    top: -9999,
    left: 0,
    width: 9999,
    flexDirection: 'row',
  },
  foodNameMeasureText: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -1.3,
    lineHeight: 32,
    color: '#FFFFFF',
    alignSelf: 'flex-start', // Text sizes to content; onLayout reports intrinsic width
  },
  foodNameMask: {
    flex: 1,
    overflow: 'hidden',
  },
  foodNameScrollTrack: {
    width: 9999,
  },
  foodNameText: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -1.3,
    lineHeight: 32,
    color: '#FFFFFF',
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
    marginBottom: 16,
    overflow: 'hidden',
  },
  capsuleBorderCutout: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: 11,
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
    width: 89,
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
  capsuleInputText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 0,
    height: 30,
  },
  capsuleUnitLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.8,
    color: '#FFFFFF',
  },
  addButtonWrap: {
    paddingHorizontal: CARD_PAD,
    marginTop: 1,
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
  dropdownShadowWrapper: {
    position: 'absolute',
    right: (SCREEN_W - 162) / 2,
    width: 72,
    height: 92,
    zIndex: 51,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  dropdownRingOuter: {
    flex: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  dropdownInsetFill: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 11,
    borderBottomRightRadius: 11,
    overflow: 'hidden',
  },
  dropdownScroll: {
    flex: 1,
  },
  dropdownItem: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
  },
  dropdownItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  dropdownItemTextSelected: {
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
    paddingBottom: 120,
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
