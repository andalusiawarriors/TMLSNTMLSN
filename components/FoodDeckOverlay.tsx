import React, { useCallback, useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Modal,
  Keyboard,
} from 'react-native';
import { Gesture, GestureDetector, NativeViewGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  withRepeat,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import {
  ArrowsClockwise,
  BookmarkSimple,
  CaretUp,
  X as XIcon,
  Check as CheckIcon,
} from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  isTmlsnTop100,
  isFoundationVerified,
  inferHouseholdPortions,
  type ParsedNutrition,
} from '../utils/foodApi';
import { ADD_MEAL_UNITS, resolveGrams, type AddMealUnit } from '../utils/unitGrams';
import { useAnimatedRingNumber } from '../hooks/useAnimatedRingNumber';
import type { MealType, DeckItem } from '../types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const CARD_H = 284;
const CARD_R = 28;
const CARD_PAD = 24;
const CARD_W = SCREEN_W;
const STACK_OFFSET = 8;
const MAX_VISIBLE = 4;

const PILLS_ROW_W = 4 * 72 + 3 * 18;
const PILLS_H_PAD = (SCREEN_W - PILLS_ROW_W) / 2;
const FOOD_NAME_W = PILLS_ROW_W - 10;
const MARQUEE_FADE_W = 40;
const MARQUEE_IDLE_MS = 2000;
const MARQUEE_SPEED = 28;
const MARQUEE_PAUSE_AT_END_MS = 1200;
const MARQUEE_PAUSE_AT_START_MS = 1800;

const SWIPE_X_THRESHOLD = 80;
const SWIPE_X_VELOCITY = 800;
const SPRING_CFG = { damping: 28, stiffness: 460, mass: 0.4 };

const SEMI_OPEN_Y = 0;
const EXPANDED_Y = -(SCREEN_H * 0.42);
const DISMISS_UP_THRESHOLD = 40;
const DISMISS_UP_VELOCITY = 500;

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack',
};
const MEAL_OPTIONS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const STATIC_UNIT_LABELS: Record<AddMealUnit, string> = {
  tbsp: 'tbsp', tsp: 'tsp', cup: '1 cup', '2cup': '2 cups', halfCup: '½ cup',
  quarterCup: '¼ cup', '100g': '100g', '1g': '1g', ml: 'ml', '100ml': '100ml', oz: 'oz',
};
function unitDisplayLabel(u: string): string {
  if (u in STATIC_UNIT_LABELS) return STATIC_UNIT_LABELS[u as AddMealUnit];
  return u;
}
function unitCompactLabel(u: string): string {
  if (u === '2cup') return '2 cup';
  return unitDisplayLabel(u);
}

function getMeshType(food: ParsedNutrition): 'gold' | 'quicksilver' | 'neutral' {
  if (isTmlsnTop100(food)) return 'gold';
  if (isFoundationVerified(food)) return 'quicksilver';
  return 'neutral';
}
function getCardGradient(mesh: 'gold' | 'quicksilver' | 'neutral'): [string, string] {
  if (mesh === 'gold') return ['#D4B896', '#A8895E'];
  if (mesh === 'quicksilver') return ['#d6d8da', '#6b6f74'];
  return ['#2F3031', '#1A1A1A'];
}
function getPillColor(mesh: 'gold' | 'quicksilver' | 'neutral'): string {
  if (mesh === 'gold') return '#D4B896';
  if (mesh === 'quicksilver') return '#B9B9B9';
  return '#2F3031';
}
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getAllPortions(food: ParsedNutrition): Array<{ label: string; gramWeight: number }> {
  const nameForInfer = `${food.name ?? ''} ${food.originalDescription ?? ''}`.trim().toLowerCase();
  const inferred = nameForInfer ? inferHouseholdPortions(nameForInfer, food.unit ?? 'g') : [];
  const apiPortions = food.portions ?? [];
  const labels = new Set(apiPortions.map((p) => p.label.toLowerCase()));
  const merged = [...apiPortions];
  for (const p of inferred) {
    if (!labels.has(p.label.toLowerCase())) { merged.unshift(p); labels.add(p.label.toLowerCase()); }
  }
  return merged;
}

function computeMacros(food: ParsedNutrition, amount: string, unit: string) {
  const amt = parseFloat(amount);
  if (!Number.isFinite(amt) || amt <= 0) return { cal: 0, protein: 0, carbs: 0, fat: 0 };
  const allPortions = getAllPortions(food);
  const grams = amt * resolveGrams(unit, allPortions);
  const scale = grams / 100;
  return {
    cal: Math.round((food.calories || 0) * scale),
    protein: Math.round((food.protein || 0) * scale),
    carbs: Math.round((food.carbs || 0) * scale),
    fat: Math.round((food.fat || 0) * scale),
  };
}

function buildAllUnits(food: ParsedNutrition): string[] {
  const merged = getAllPortions(food);
  return [...merged.map((p) => p.label), ...(ADD_MEAL_UNITS as readonly string[])];
}

/* ---- Nutrition rows ---- */
type NutritionRowData = { key: string; label: string; value: string; dri?: string; indent?: boolean };
const DRI: Record<string, number> = {
  calories: 2000, totalFat: 78, saturatedFat: 20, cholesterol: 300, sodium: 2300,
  totalCarbs: 275, fiber: 28, sugars: 50, protein: 50, vitaminA: 900, vitaminC: 90,
  vitaminD: 20, vitaminE: 15, vitaminK: 120, thiamin: 1.2, riboflavin: 1.3, niacin: 16,
  vitaminB6: 1.7, folate: 400, vitaminB12: 2.4, calcium: 1300, iron: 18, potassium: 4700,
  magnesium: 420, phosphorus: 1250, zinc: 11, copper: 0.9, manganese: 2.3, selenium: 55,
};
function driPct(value: number, driKey: string): string | undefined {
  const ref = DRI[driKey]; if (!ref || value === 0) return undefined;
  return `${Math.round((value / ref) * 100)}%`;
}
function buildNutritionRows(food: ParsedNutrition, scl: number): NutritionRowData[] {
  const dash = '—';
  const fG = (v: number) => v === 0 ? dash : `${parseFloat(v.toFixed(1))}g`;
  const fMg = (v: number) => v === 0 ? dash : `${Math.round(v)}mg`;
  const fMcg = (v: number) => v === 0 ? dash : `${v.toFixed(1)}mcg`;
  const fMgP = (v: number) => v === 0 ? dash : `${v.toFixed(2)}mg`;
  const rows: NutritionRowData[] = [];
  const sc = Math.round((food.calories || 0) * scl);
  rows.push({ key: 'cal', label: 'calories', value: sc === 0 ? dash : String(sc) });
  rows.push({ key: 'fat', label: 'total fat', value: fG((food.fat || 0) * scl) });
  const sf = (food.saturatedFat ?? 0) * scl;
  rows.push({ key: 'satfat', label: 'saturated fat', value: fG(sf), dri: sf > 0 ? driPct(sf, 'saturatedFat') : undefined, indent: true });
  rows.push({ key: 'transfat', label: 'trans fat', value: fG((food.transFat ?? 0) * scl), indent: true });
  const ch = (food.cholesterol ?? 0) * scl;
  rows.push({ key: 'chol', label: 'cholesterol', value: fMg(ch), dri: ch > 0 ? driPct(ch, 'cholesterol') : undefined });
  const so = (food.sodium ?? 0) * scl;
  rows.push({ key: 'sodium', label: 'sodium', value: fMg(so), dri: so > 0 ? driPct(so, 'sodium') : undefined });
  rows.push({ key: 'carbs', label: 'total carbs', value: fG((food.carbs || 0) * scl) });
  const fi = (food.fiber ?? 0) * scl;
  rows.push({ key: 'fiber', label: 'dietary fiber', value: fG(fi), dri: fi > 0 ? driPct(fi, 'fiber') : undefined, indent: true });
  const su = (food.sugars ?? 0) * scl;
  rows.push({ key: 'sugars', label: 'sugars', value: fG(su), dri: su > 0 ? driPct(su, 'sugars') : undefined, indent: true });
  rows.push({ key: 'protein', label: 'protein', value: fG((food.protein || 0) * scl) });
  for (const v of [
    { key: 'vitA', label: 'vitamin A', val: food.vitaminA ?? 0, dk: 'vitaminA', mcg: true },
    { key: 'vitC', label: 'vitamin C', val: food.vitaminC ?? 0, dk: 'vitaminC', mcg: false },
    { key: 'vitD', label: 'vitamin D', val: food.vitaminD ?? 0, dk: 'vitaminD', mcg: true },
    { key: 'b6', label: 'vitamin B6', val: food.vitaminB6 ?? 0, dk: 'vitaminB6', mcg: false },
    { key: 'b12', label: 'vitamin B12', val: food.vitaminB12 ?? 0, dk: 'vitaminB12', mcg: true },
  ]) { const s2 = v.val * scl; rows.push({ key: v.key, label: v.label, value: v.mcg ? fMcg(s2) : fMgP(s2), dri: s2 > 0 ? driPct(s2, v.dk) : undefined }); }
  for (const m of [
    { key: 'calcium', label: 'calcium', val: food.calcium ?? 0, dk: 'calcium' },
    { key: 'iron', label: 'iron', val: food.iron ?? 0, dk: 'iron' },
    { key: 'potassium', label: 'potassium', val: food.potassium ?? 0, dk: 'potassium' },
    { key: 'magnesium', label: 'magnesium', val: food.magnesium ?? 0, dk: 'magnesium' },
  ]) { const s2 = m.val * scl; rows.push({ key: m.key, label: m.label, value: fMg(s2), dri: s2 > 0 ? driPct(s2, m.dk) : undefined }); }
  return rows;
}

/* ---- Props ---- */
export interface FoodDeckOverlayProps {
  items: DeckItem[];
  onUpdateItems: (items: DeckItem[]) => void;
  onLogFood: (item: DeckItem, mealType: MealType) => void;
  onSaveFood: (food: ParsedNutrition, amount?: string, unit?: string) => void;
  onDismissAll: () => void;
  onReloadItem: (item: DeckItem) => Promise<ParsedNutrition | null>;
  onPreviewMacros?: (macros: { cal: number; protein: number; carbs: number; fat: number }) => void;
  cardTopOffset?: number;
}

/* ---- AnimatedDropdown ---- */
function AnimatedDropdown({
  visible, options, selectedKey, onSelect, onClose, style,
}: {
  visible: boolean;
  options: { key: string; label: string }[];
  selectedKey?: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
  style?: any;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 180 : 140,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [visible, progress]);
  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.92 + progress.value * 0.08 }, { translateY: (1 - progress.value) * -6 }],
  }));
  if (!visible) return null;
  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[ddStyles.wrapper, animStyle, style]}>
        <View style={ddStyles.ring}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFillObject} />
          <ScrollView style={ddStyles.scroll} bounces showsVerticalScrollIndicator={false}>
            {options.map((opt) => (
              <Pressable key={opt.key} style={({ pressed }) => [ddStyles.item, pressed && ddStyles.itemPressed]}
                onPress={() => { onSelect(opt.key); onClose(); }}>
                <Text style={[ddStyles.itemText, selectedKey === opt.key && ddStyles.itemTextSelected]}>{opt.label}</Text>
                {selectedKey === opt.key && <CheckIcon size={14} color="#FFFFFF" weight="bold" style={{ marginLeft: 6 }} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
    </>
  );
}
const ddStyles = StyleSheet.create({
  wrapper: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8 },
  ring: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  scroll: { maxHeight: 200, padding: 6 },
  item: { height: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 8 },
  itemPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  itemText: { fontSize: 14, fontWeight: '500', color: '#FFFFFF', flex: 1 },
  itemTextSelected: { fontWeight: '700' },
});

/* ---- DeckCard ---- */
interface DeckCardProps {
  item: DeckItem;
  index: number;
  total: number;
  isFront: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onUpdateItem: (updated: DeckItem) => void;
  onReload: () => Promise<ParsedNutrition | null>;
  onSave: (withQuantity: boolean) => void;
  onLog: () => void;
  onPreviewMacros?: (m: { cal: number; protein: number; carbs: number; fat: number }) => void;
}

function DeckCard({
  item, index, isFront,
  onSwipeLeft, onSwipeRight, onUpdateItem, onReload, onSave, onLog, onPreviewMacros,
}: DeckCardProps) {
  const insets = useSafeAreaInsets();
  const { food, amount, unit, mealType } = item;
  const mesh = getMeshType(food);
  const cardGradient = getCardGradient(mesh);
  const pillColor = getPillColor(mesh);
  const allPortions = useMemo(() => getAllPortions(food), [food]);
  const macros = computeMacros(food, amount, unit);
  const animPillCal = useAnimatedRingNumber(macros.cal, 300, { haptic: 'none' });
  const animPillProtein = useAnimatedRingNumber(macros.protein, 300, { haptic: 'none' });
  const animPillCarbs = useAnimatedRingNumber(macros.carbs, 300, { haptic: 'none' });
  const animPillFat = useAnimatedRingNumber(macros.fat, 300, { haptic: 'none' });
  const scalingFactor = (parseFloat(amount) || 1) * resolveGrams(unit, allPortions) / 100;
  const nutritionRows = useMemo(() => buildNutritionRows(food, scalingFactor), [food, scalingFactor]);
  const allUnits = useMemo(() => buildAllUnits(food), [food]);

  useEffect(() => {
    if (isFront && onPreviewMacros) onPreviewMacros(macros);
  }, [macros.cal, macros.protein, macros.carbs, macros.fat, isFront]);

  const translateX = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SEMI_OPEN_Y);
  const isExpanded = useSharedValue(0);
  const scrollOffsetSV = useSharedValue(0);
  const gestureStartedAtTopSV = useSharedValue(0);
  const collapsingFromTopSV = useSharedValue(0);
  const swipeOverlayOpacity = useSharedValue(0);
  const swipeIconType = useSharedValue<'none' | 'x' | 'check'>('none');
  const shakeAnim = useSharedValue(0);
  const buttonShakeAnim = useSharedValue(0);

  const nativeScrollRef = useRef<any>(null);
  const [scrollEnabled, setScrollEnabled] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);
  const [mealDropdownOpen, setMealDropdownOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);
  const [qtyFocused, setQtyFocused] = useState(false);

  const [nameOverflow, setNameOverflow] = useState(0);
  const marqueeX = useSharedValue(0);
  const marqueeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayName = food.name || 'unknown food';

  const handleNameMeasure = useCallback((e: any) => {
    const w = e.nativeEvent?.layout?.width ?? 0;
    const overflow = Math.max(0, w - FOOD_NAME_W);
    setNameOverflow((prev) => (Math.abs(prev - overflow) > 1 ? overflow : prev));
  }, []);

  useEffect(() => { setNameOverflow(0); cancelAnimation(marqueeX); marqueeX.value = 0; }, [displayName, marqueeX]);

  useEffect(() => {
    if (marqueeTimerRef.current) clearTimeout(marqueeTimerRef.current);
    cancelAnimation(marqueeX); marqueeX.value = 0;
    if (nameOverflow > 0 && isFront) {
      const dur = Math.max(nameOverflow * MARQUEE_SPEED, 1500);
      marqueeTimerRef.current = setTimeout(() => {
        marqueeX.value = withRepeat(withSequence(
          withTiming(-nameOverflow, { duration: dur, easing: Easing.linear }),
          withDelay(MARQUEE_PAUSE_AT_END_MS, withTiming(-nameOverflow, { duration: 1 })),
          withTiming(0, { duration: dur, easing: Easing.linear }),
          withDelay(MARQUEE_PAUSE_AT_START_MS, withTiming(0, { duration: 1 })),
        ), -1);
      }, MARQUEE_IDLE_MS);
    }
    return () => { if (marqueeTimerRef.current) clearTimeout(marqueeTimerRef.current); };
  }, [nameOverflow, isFront, marqueeX]);

  const marqueeAnimStyle = useAnimatedStyle(() => ({ transform: [{ translateX: marqueeX.value }] }));

  const triggerShake = useCallback(() => {
    shakeAnim.value = withSequence(
      withTiming(10, { duration: 50 }), withTiming(-10, { duration: 50 }),
      withTiming(8, { duration: 50 }), withTiming(-8, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [shakeAnim]);
  const triggerButtonShake = useCallback(() => {
    buttonShakeAnim.value = withSequence(
      withTiming(10, { duration: 50 }), withTiming(-10, { duration: 50 }),
      withTiming(8, { duration: 50 }), withTiming(-8, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [buttonShakeAnim]);

  const doSwipeLeft = useCallback(() => onSwipeLeft(), [onSwipeLeft]);
  const doSwipeRight = useCallback(() => onSwipeRight(), [onSwipeRight]);
  const doSwipeRightNoMeal = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    triggerShake();
  }, [triggerShake]);

  const sheetGesture = Gesture.Pan()
    .enabled(isFront)
    .simultaneousWithExternalGesture(nativeScrollRef as any)
    .activeOffsetX([-15, 15])
    .activeOffsetY([-10, 10])
    .onBegin(() => {
      gestureStartedAtTopSV.value = scrollOffsetSV.value <= 2 ? 1 : 0;
      collapsingFromTopSV.value = 0;
    })
    .onUpdate((e) => {
      const absX = Math.abs(e.translationX);
      const absY = Math.abs(e.translationY);

      if (absX > absY * 0.7) {
        translateX.value = e.translationX;
        const progress = Math.min(absX / SWIPE_X_THRESHOLD, 1);
        swipeOverlayOpacity.value = progress * 0.7;
        swipeIconType.value = e.translationX < -20 ? 'x' : e.translationX > 20 ? 'check' : 'none';
        return;
      }

      if (isExpanded.value === 0) {
        // Clamp: can't go below SEMI_OPEN_Y (no downward drift) and no further up than EXPANDED_Y
        sheetTranslateY.value = Math.max(EXPANDED_Y, Math.min(SEMI_OPEN_Y, SEMI_OPEN_Y + e.translationY));
      } else if ((gestureStartedAtTopSV.value === 1) && e.translationY > 0) {
        if (collapsingFromTopSV.value === 0) {
          collapsingFromTopSV.value = 1;
          runOnJS(setScrollEnabled)(false);
        }
        sheetTranslateY.value = EXPANDED_Y + e.translationY;
      }
    })
    .onEnd((e) => {
      const absX = Math.abs(e.translationX);
      const isLeftSwipe = e.translationX < -SWIPE_X_THRESHOLD || e.velocityX < -SWIPE_X_VELOCITY;
      const isRightSwipe = e.translationX > SWIPE_X_THRESHOLD || e.velocityX > SWIPE_X_VELOCITY;

      if (absX > Math.abs(e.translationY) * 0.7 && isLeftSwipe) {
        translateX.value = withTiming(-SCREEN_W * 1.5, { duration: 220, easing: Easing.in(Easing.cubic) }, () => runOnJS(doSwipeLeft)());
        swipeOverlayOpacity.value = withTiming(0, { duration: 220 });
        return;
      }
      if (absX > Math.abs(e.translationY) * 0.7 && isRightSwipe) {
        if (item.mealType) {
          translateX.value = withTiming(SCREEN_W * 1.5, { duration: 220, easing: Easing.in(Easing.cubic) }, () => runOnJS(doSwipeRight)());
          swipeOverlayOpacity.value = withTiming(0, { duration: 220 });
        } else {
          translateX.value = withSpring(0, SPRING_CFG);
          swipeOverlayOpacity.value = withTiming(0, { duration: 150 });
          swipeIconType.value = 'none';
          runOnJS(doSwipeRightNoMeal)();
        }
        return;
      }

      translateX.value = withSpring(0, SPRING_CFG);
      swipeOverlayOpacity.value = withTiming(0, { duration: 150 });
      swipeIconType.value = 'none';

      if (isExpanded.value === 0) {
        if (e.translationY < -DISMISS_UP_THRESHOLD || e.velocityY < -DISMISS_UP_VELOCITY) {
          isExpanded.value = 1;
          runOnJS(setScrollEnabled)(true);
          sheetTranslateY.value = withTiming(EXPANDED_Y, { duration: 260, easing: Easing.out(Easing.cubic) });
        } else {
          sheetTranslateY.value = withSpring(SEMI_OPEN_Y, SPRING_CFG);
        }
      } else {
        if (collapsingFromTopSV.value === 1) {
          isExpanded.value = 0;
          runOnJS(setScrollEnabled)(false);
          sheetTranslateY.value = withSpring(SEMI_OPEN_Y, SPRING_CFG);
        }
      }
    });

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value + shakeAnim.value }],
  }));
  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  const xOverlayStyle = useAnimatedStyle(() => ({ opacity: swipeIconType.value === 'x' ? swipeOverlayOpacity.value : 0 }));
  const checkOverlayStyle = useAnimatedStyle(() => ({ opacity: swipeIconType.value === 'check' ? swipeOverlayOpacity.value : 0 }));
  const buttonShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: buttonShakeAnim.value }] }));
  const stackStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(index * STACK_OFFSET) }],
    zIndex: MAX_VISIBLE - index,
  }));

  const handleAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (cleaned === '' || /^\d{0,3}(\.\d{0,2})?$/.test(cleaned)) {
      if (cleaned !== '') {
        const amt = parseFloat(cleaned);
        if (Number.isFinite(amt) && amt > 0) {
          const grams = amt * resolveGrams(unit, allPortions);
          const scale = grams / 100;
          const cal = Math.round((food.calories || 0) * scale);
          const p = (food.protein || 0) * scale;
          const c = (food.carbs || 0) * scale;
          const f = (food.fat || 0) * scale;
          if (cal > 9999 || p > 999.9 || c > 999.9 || f > 999.9) return;
        }
      }
      if (cleaned !== amount) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onUpdateItem({ ...item, amount: cleaned });
    }
  }, [item, amount, unit, food, allPortions, onUpdateItem]);

  const handleUnitChange = useCallback((newUnit: string) => {
    const toggleUnits = ['cup', '2cup', '100g', '100ml'];
    if (toggleUnits.includes(newUnit)) { onUpdateItem({ ...item, unit: newUnit, amount: '0' }); return; }
    const amt = parseFloat(amount);
    const hasValid = Number.isFinite(amt) && amt > 0;
    const gramsPerNew = resolveGrams(newUnit, allPortions);
    if (!hasValid || gramsPerNew <= 0) { onUpdateItem({ ...item, unit: newUnit, amount: hasValid ? amount : '1' }); return; }
    if (toggleUnits.includes(unit)) { onUpdateItem({ ...item, unit: newUnit, amount: '0' }); return; }
    const gramsPerOld = resolveGrams(unit, allPortions);
    const totalGrams = amt * gramsPerOld;
    const newAmt = totalGrams / gramsPerNew;
    const rounded = newAmt >= 10 ? Math.round(newAmt) : parseFloat(newAmt.toFixed(1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onUpdateItem({ ...item, unit: newUnit, amount: String(rounded) });
  }, [item, amount, unit, allPortions, onUpdateItem]);

  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      const result = await onReload();
      if (!result) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); triggerShake(); }
    } catch { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); triggerShake(); }
    finally { setReloading(false); }
  }, [onReload, triggerShake]);

  const handleLog = useCallback(() => {
    if (!mealType) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); triggerButtonShake(); return; }
    onLog();
  }, [mealType, onLog, triggerButtonShake]);

  const handleMealSelect = useCallback((key: string) => { onUpdateItem({ ...item, mealType: key as MealType }); setMealDropdownOpen(false); }, [item, onUpdateItem]);
  const handleBookmarkSelect = useCallback((key: string) => { if (key === 'food_only') onSave(false); else onSave(true); setBookmarkOpen(false); }, [onSave]);

  const isActive = mealType !== null;
  const mainBtnW = CARD_W - CARD_PAD * 2 - 43 - 8;

  return (
    <Animated.View style={[styles.cardStackSlot, stackStyle]} pointerEvents={isFront ? 'auto' : 'none'}>
      <GestureDetector gesture={sheetGesture}>
        <Animated.View style={[styles.cardOuter, cardAnimStyle]}>
          <Animated.View style={[{ width: CARD_W }, sheetAnimStyle]}>
            {/* Dark sheet container: holds nutrition scroll + gold card on top */}
            <View style={styles.sheetContainer}>

              {/* Nutrition ScrollView behind gold card */}
              <NativeViewGestureHandler ref={nativeScrollRef}>
                <ScrollView
                  style={styles.nutritionScroll}
                  contentContainerStyle={[styles.nutritionScrollContent, { paddingTop: CARD_H + 24, paddingBottom: Math.max(60, insets.bottom + 90) }]}
                  showsVerticalScrollIndicator={false}
                  scrollEnabled={isFront && scrollEnabled}
                  nestedScrollEnabled
                  bounces
                  scrollEventThrottle={16}
                  onScroll={(e) => { scrollOffsetSV.value = e.nativeEvent.contentOffset.y; }}
                >
                  <Text style={styles.nutritionDataHeading}>nutritional data</Text>
                  <View style={styles.nutritionDataCard}>
                    {nutritionRows.map((row, i, arr) => (
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

              {/* Gold card zone */}
              <View style={styles.cardZone}>
                <LinearGradient colors={cardGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.meshContainer} />
                <View style={styles.cardInner}>
                  <Animated.View style={[styles.swipeOverlay, xOverlayStyle]} pointerEvents="none">
                    <XIcon size={40} color="#FF4444" weight="bold" />
                  </Animated.View>
                  <Animated.View style={[styles.swipeOverlay, checkOverlayStyle]} pointerEvents="none">
                    <CheckIcon size={40} color="#44FF44" weight="bold" />
                  </Animated.View>

                  <View style={styles.headerDragZone}><View style={styles.grabber} /></View>

                  {/* Reload — top-left near corner rounding */}
                  <Pressable style={[styles.circleBtn, styles.circleBtnLeft, { backgroundColor: pillColor }]} onPress={handleReload} disabled={reloading}>
                    {reloading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <ArrowsClockwise size={16} color="#FFFFFF" weight="regular" />}
                  </Pressable>
                  {/* Bookmark — top-right near corner rounding */}
                  <Pressable style={[styles.circleBtn, styles.circleBtnRight, { backgroundColor: pillColor }]} onPress={() => setBookmarkOpen(!bookmarkOpen)}>
                    <BookmarkSimple size={16} color="#FFFFFF" weight="regular" />
                  </Pressable>

                  {/* Food name with marquee */}
                  <View style={[styles.foodNameOuter, food.brand && mesh === 'neutral' && styles.foodNameOuterTightBottom]}>
                    <View style={styles.foodNameMeasureWrap}>
                      <Text style={styles.foodNameMeasureText} onLayout={handleNameMeasure}>{displayName}</Text>
                    </View>
                    {nameOverflow > 0 ? (
                      <MaskedView style={styles.foodNameMask} maskElement={
                        <LinearGradient colors={['#000', '#000', 'transparent']} locations={[0, 1 - MARQUEE_FADE_W / FOOD_NAME_W, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
                      }>
                        <Animated.View style={[styles.foodNameScrollTrack, marqueeAnimStyle]}>
                          <Text style={styles.foodNameText}>{displayName}</Text>
                        </Animated.View>
                      </MaskedView>
                    ) : (
                      <Text style={styles.foodNameText} numberOfLines={1}>{displayName}</Text>
                    )}
                  </View>

                  {food.brand ? <Text style={[styles.brandName, (mesh === 'gold' || mesh === 'quicksilver') && styles.brandNameOverlay]} numberOfLines={1}>{food.brand}</Text> : null}

                  <View style={styles.statsRow}>
                    {[
                      { value: String(animPillCal), label: 'calories' },
                      { value: `${animPillProtein}g`, label: 'protein' },
                      { value: `${animPillCarbs}g`, label: 'carbs' },
                      { value: `${animPillFat}g`, label: 'fat' },
                    ].map((pill, i) => (
                      <View key={i} style={[styles.statPill, { backgroundColor: withAlpha(pillColor, 0.2) }]}>
                        <Text style={styles.statValue}>{pill.value}</Text>
                        <Text style={styles.statLabel}>{pill.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.capsule}>
                    <Pressable style={styles.capsuleLeft}>
                      <TextInput value={amount} onChangeText={handleAmountChange} keyboardType="decimal-pad" maxLength={6}
                        placeholder="1" placeholderTextColor="rgba(255,255,255,0.4)" style={styles.capsuleInput}
                        onFocus={() => setQtyFocused(true)} onBlur={() => setQtyFocused(false)} />
                    </Pressable>
                    <View style={styles.capsuleDivider} />
                    <Pressable style={styles.capsuleRight} onPress={() => setUnitDropdownOpen(!unitDropdownOpen)}>
                      <Text style={styles.capsuleUnitLabel}>{unitCompactLabel(unit)}</Text>
                    </Pressable>
                  </View>

                  <Animated.View style={[styles.splitBtnRow, buttonShakeStyle]}>
                    <Pressable style={[styles.logBtn, { width: mainBtnW }, isActive ? styles.btnActive : styles.btnInactive]} onPress={handleLog}>
                      <Text style={[styles.logBtnText, !isActive && styles.btnTextInactive]}>{isActive ? `log to ${MEAL_LABELS[mealType!]}` : 'log food'}</Text>
                    </Pressable>
                    <Pressable style={[styles.arrowBtn, isActive ? styles.btnActive : styles.btnInactive]} onPress={() => setMealDropdownOpen(!mealDropdownOpen)}>
                      <CaretUp size={18} color={isActive ? '#000000' : 'rgba(0,0,0,0.5)'} weight="bold" />
                    </Pressable>
                  </Animated.View>
                </View>

              </View>
              {qtyFocused && <Pressable style={[StyleSheet.absoluteFill, { zIndex: 5 }]} onPress={() => Keyboard.dismiss()} />}
            </View>
          </Animated.View>

          {/* Dropdowns outside the sheet so they're not clipped */}
          <AnimatedDropdown visible={bookmarkOpen} options={[{ key: 'food_only', label: 'save food only' }, { key: 'food_qty', label: 'save food and quantity' }]}
            onSelect={handleBookmarkSelect} onClose={() => setBookmarkOpen(false)} style={styles.bookmarkDropdown} />
          <AnimatedDropdown visible={mealDropdownOpen} options={MEAL_OPTIONS.map((m) => ({ key: m, label: MEAL_LABELS[m] }))}
            selectedKey={mealType} onSelect={handleMealSelect} onClose={() => setMealDropdownOpen(false)} style={styles.mealDropdown} />
          <AnimatedDropdown visible={unitDropdownOpen} options={allUnits.map((u) => ({ key: u, label: unitDisplayLabel(u) }))}
            selectedKey={unit} onSelect={(k) => { handleUnitChange(k); setUnitDropdownOpen(false); }} onClose={() => setUnitDropdownOpen(false)} style={styles.unitDropdown} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/* ---- FoodDeckOverlay ---- */
export function FoodDeckOverlay({
  items, onUpdateItems, onLogFood, onSaveFood, onDismissAll, onReloadItem, onPreviewMacros, cardTopOffset = 0,
}: FoodDeckOverlayProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleSwipeLeft = useCallback((idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    next.length === 0 ? onDismissAll() : onUpdateItems(next);
  }, [items, onUpdateItems, onDismissAll]);

  const handleSwipeRight = useCallback((idx: number) => {
    const it = items[idx];
    if (it.mealType) {
      onLogFood(it, it.mealType);
      const next = items.filter((_, i) => i !== idx);
      next.length === 0 ? onDismissAll() : onUpdateItems(next);
    }
  }, [items, onUpdateItems, onLogFood, onDismissAll]);

  const handleUpdateItem = useCallback((idx: number, updated: DeckItem) => {
    const next = [...items]; next[idx] = updated; onUpdateItems(next);
  }, [items, onUpdateItems]);

  const handleReload = useCallback(async (idx: number) => {
    const it = items[idx];
    const result = await onReloadItem(it);
    if (result) {
      if (items.length === 1) { const n = [...items]; n[idx] = { ...it, food: result }; onUpdateItems(n); }
      else { const without = items.filter((_, i) => i !== idx); onUpdateItems([...without, { ...it, food: result, id: it.id + '_r' }]); }
    }
    return result;
  }, [items, onUpdateItems, onReloadItem]);

  const handleSave = useCallback((idx: number, wq: boolean) => {
    const it = items[idx]; wq ? onSaveFood(it.food, it.amount, it.unit) : onSaveFood(it.food);
  }, [items, onSaveFood]);

  const handleLog = useCallback((idx: number) => {
    const it = items[idx];
    if (it.mealType) {
      onLogFood(it, it.mealType);
      const next = items.filter((_, i) => i !== idx);
      next.length === 0 ? onDismissAll() : onUpdateItems(next);
    }
  }, [items, onUpdateItems, onLogFood, onDismissAll]);

  const handleBackdropTap = useCallback(() => {
    if (Keyboard.isVisible()) { Keyboard.dismiss(); return; }
    setShowExitConfirm(true);
  }, []);
  const confirmExit = useCallback(() => { setShowExitConfirm(false); onDismissAll(); }, [onDismissAll]);

  if (items.length === 0) return null;
  const visibleItems = items.slice(0, MAX_VISIBLE);
  const stackAbove = (Math.min(items.length, MAX_VISIBLE) - 1) * STACK_OFFSET;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Full-area backdrop for dismiss */}
      <Pressable style={styles.backdrop} onPress={handleBackdropTap} />
      <View style={{ position: 'absolute', top: cardTopOffset, left: 0, right: 0 }} pointerEvents="box-none">
        {visibleItems.map((it, idx) => (
          <DeckCard key={it.id} item={it} index={idx} total={visibleItems.length} isFront={idx === 0}
            onSwipeLeft={() => handleSwipeLeft(idx)} onSwipeRight={() => handleSwipeRight(idx)}
            onUpdateItem={(u) => handleUpdateItem(idx, u)} onReload={() => handleReload(idx)}
            onSave={(wq) => handleSave(idx, wq)} onLog={() => handleLog(idx)} onPreviewMacros={onPreviewMacros} />
        )).reverse()}
        {items.length > 1 && <View style={[styles.countBadge, { top: -stackAbove - 8 }]}><Text style={styles.countText}>{items.length}</Text></View>}
      </View>
      <Modal visible={showExitConfirm} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>are you sure?</Text>
            <View style={styles.confirmBtnRow}>
              <Pressable style={[styles.confirmBtn, styles.confirmBtnKeep]} onPress={() => setShowExitConfirm(false)}>
                <Text style={styles.confirmBtnKeepText}>keep logging</Text>
              </Pressable>
              <Pressable style={[styles.confirmBtn, styles.confirmBtnExit]} onPress={confirmExit}>
                <Text style={styles.confirmBtnExitText}>yes i'm sure</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ---- Styles ---- */
const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: SCREEN_W, flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },

  cardStackSlot: { position: 'absolute', top: 0, width: CARD_W },
  cardOuter: { width: CARD_W },

  sheetContainer: {
    width: CARD_W,
    height: SCREEN_H,
    backgroundColor: '#2F3031',
    borderTopLeftRadius: CARD_R,
    borderTopRightRadius: CARD_R,
    overflow: 'hidden',
  },
  cardZone: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: CARD_H,
    borderRadius: CARD_R,
    zIndex: 2,
    overflow: 'hidden',
    shadowColor: '#505050',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15.8,
    elevation: 8,
  },
  meshContainer: { ...StyleSheet.absoluteFillObject, borderRadius: CARD_R, overflow: 'hidden' },
  cardInner: { flex: 1 },

  swipeOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: CARD_R,
  },
  headerDragZone: { paddingTop: 10, backgroundColor: 'transparent' },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', marginBottom: 8 },

  circleBtn: { position: 'absolute', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  circleBtnLeft: { top: 14, left: 12 },
  circleBtnRight: { top: 14, right: 12 },

  foodNameOuter: { marginLeft: PILLS_H_PAD, width: FOOD_NAME_W, overflow: 'hidden', height: 34, marginBottom: 16 },
  foodNameMeasureWrap: { position: 'absolute', top: -9999, left: 0, width: 9999, flexDirection: 'row' },
  foodNameMeasureText: { fontSize: 26, fontWeight: '700', letterSpacing: -1.3, lineHeight: 32, color: '#FFFFFF', alignSelf: 'flex-start' },
  foodNameMask: { flex: 1, overflow: 'hidden' },
  foodNameScrollTrack: { width: 9999 },
  foodNameText: { fontSize: 26, fontWeight: '700', letterSpacing: -1.3, lineHeight: 32, color: '#FFFFFF' },

  brandName: { fontSize: 10, fontWeight: '600', letterSpacing: -0.5, color: '#FFFFFF', opacity: 0.7, textTransform: 'uppercase', marginLeft: PILLS_H_PAD },
  brandNameOverlay: { marginTop: -20, marginBottom: 8 },
  foodNameOuterTightBottom: { marginBottom: 2 },

  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginBottom: 20 },
  statPill: { width: 72, height: 51, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', letterSpacing: -1.0, color: '#FFFFFF', textAlign: 'center' },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: -0.5, color: '#FFFFFF', textAlign: 'center' },

  capsule: { width: 162, height: 32, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  capsuleLeft: { width: 89, alignItems: 'center', justifyContent: 'center' },
  capsuleDivider: { width: 1.8, height: 16, backgroundColor: 'rgba(255,255,255,0.62)' },
  capsuleRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  capsuleInput: { width: '100%' as any, textAlign: 'center', fontSize: 14, fontWeight: '600', letterSpacing: -0.4, color: '#FFFFFF', paddingVertical: 0, height: 30 },
  capsuleUnitLabel: { fontSize: 16, fontWeight: '600', letterSpacing: -0.8, color: '#FFFFFF' },

  splitBtnRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 1, paddingHorizontal: CARD_PAD },
  logBtn: { height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logBtnText: { fontSize: 18, fontWeight: '700', letterSpacing: -0.9, color: '#000000' },
  arrowBtn: { width: 43, height: 43, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnActive: { backgroundColor: '#FFFFFF' },
  btnInactive: { backgroundColor: 'rgba(255,255,255,0.5)' },
  btnTextInactive: { opacity: 0.5 },

  bookmarkDropdown: { position: 'absolute', top: 48, right: 10, zIndex: 60, width: 200 },
  mealDropdown: { position: 'absolute', top: CARD_H - 48, right: CARD_PAD, zIndex: 60, width: 160 },
  unitDropdown: { position: 'absolute', top: CARD_H - 90, left: (SCREEN_W - 162) / 2 + 81, zIndex: 60, width: 120 },

  countBadge: { position: 'absolute', right: CARD_PAD - 4, width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', zIndex: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  countText: { fontSize: 13, fontWeight: '700', color: '#000000' },

  nutritionScroll: { flex: 1 },
  nutritionScrollContent: { paddingHorizontal: 16, paddingBottom: 60 },
  nutritionDataHeading: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 16 },
  nutritionDataCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  nutritionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  nutritionRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  nutritionRowIndent: { paddingLeft: 32 },
  nutritionRowLabel: { fontSize: 15, fontWeight: '400', color: '#FFFFFF' },
  nutritionRowLabelSub: { color: 'rgba(255,255,255,0.5)' },
  nutritionRowRight: { alignItems: 'flex-end' },
  nutritionRowValue: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  nutritionRowDri: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.35)', marginTop: 1 },

  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  confirmBox: { width: 280, backgroundColor: '#2F3031', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 20 },
  confirmBtnRow: { flexDirection: 'row', gap: 12 },
  confirmBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirmBtnKeep: { backgroundColor: '#FFFFFF' },
  confirmBtnKeepText: { fontSize: 15, fontWeight: '700', color: '#000000' },
  confirmBtnExit: { backgroundColor: 'rgba(255,255,255,0.12)' },
  confirmBtnExitText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
});

export default FoodDeckOverlay;
