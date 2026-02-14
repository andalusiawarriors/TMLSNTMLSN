import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  Image,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
  FlatList,
  TextInput,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { BlurRollNumber } from '../../components/BlurRollNumber';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import {
  getNutritionLogByDate,
  saveNutritionLog,
  getUserSettings,
  saveUserSettings,
  getSavedFoods,
  saveSavedFood,
} from '../../utils/storage';
import { NutritionLog, Meal, MealType, UserSettings, SavedFood } from '../../types';
import { generateId, getTodayDateString, toDateString } from '../../utils/helpers';
import SwipeableWeekView from '../../components/SwipeableWeekView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchByBarcode, searchFoods, ParsedNutrition } from '../../utils/foodApi';
import { analyzeFood, readNutritionLabel, isGeminiConfigured } from '../../utils/geminiApi';

// EB Garamond for Calorie tab (headings, modals, etc.)
const Font = {
  regular: 'EBGaramond_400Regular',
  medium: 'EBGaramond_500Medium',
  semiBold: 'EBGaramond_600SemiBold',
  bold: 'EBGaramond_700Bold',
  extraBold: 'EBGaramond_800ExtraBold',
} as const;

// DM Mono for calories/macro cards (as in tab bar)
const CardFont = {
  family: 'DMMono_500Medium',
  letterSpacing: -0.1,
} as const;

const HeadingLetterSpacing = -1;
const CARD_LABEL_COLOR = '#FFFFFF';
const CARD_NUMBER_COLOR = '#FFFFFF'; // quantity text on cards – full white, animation restores to this
const CARD_UNIFIED_HEIGHT = Math.round(100 * 1.2); // 20% taller, all cards same height (120)
const MAIN_CARD_RING_SIZE = 100;
const SMALL_CARD_RING_SIZE = Math.round(61 * 0.95); // 5% smaller (58)
// Card fonts: 50% of base; macro labels (Calories left, Protein left, etc.) another 10% smaller (45% total)
const CARD_VALUE_FONT_SIZE = Math.round((Typography.h1 + 8) * 0.5); // 20
const CARD_LABEL_FONT_SIZE = Math.round(Typography.body * 0.45);   // 8 (Calories left)
const MACRO_VALUE_FONT_SIZE = Math.round(Typography.dataValue * 0.5); // 10
const MACRO_LABEL_FONT_SIZE = Math.round(Typography.label * 0.45);   // 6 (Protein left, etc.)

const WEEK_STRIP_PAGE_WIDTH = Dimensions.get('window').width - Spacing.md * 2;

export default function NutritionScreen() {
  const [viewingDate, setViewingDate] = useState<string>(() => getTodayDateString());
  const [todayLog, setTodayLog] = useState<NutritionLog | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showEditGoals, setShowEditGoals] = useState(false);
  const [cardPage, setCardPage] = useState(0);

  const viewingDateAsDate = useMemo(() => new Date(viewingDate + 'T12:00:00'), [viewingDate]);

  const cardScale = useSharedValue(1);
  const cardScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const fabScale = useSharedValue(1);
  const fabStretchX = useSharedValue(0); // very subtle scale in drag direction
  const fabStretchY = useSharedValue(0);
  const FAB_STRETCH_FACTOR = 0.0005; // very very subtle stretch toward drag
  const FAB_STRETCH_MAX = 0.012; // max ~1.2% scale change
  const FAB_PRESS_SCALE = 1.12; // enlarge on press (same magnitude as previous shrink 0.88 → 1)
  const FAB_PRESS_DURATION_MS = 260; // smooth enlargement
  const FAB_PRESS_EASING = Easing.bezier(0.33, 0.2, 0.2, 1); // smooth ease-out
  const FAB_RETURN_DURATION_MS = 55; // shrink back on release almost instant
  const FAB_ROTATION_SPRING = { damping: 55, stiffness: 264 }; // plus↔X and star, 10% faster
  const fabScaleStyle = useAnimatedStyle(() => {
    'worklet';
    const sx = 1 + Math.max(-FAB_STRETCH_MAX, Math.min(FAB_STRETCH_MAX, fabStretchX.value));
    const sy = 1 + Math.max(-FAB_STRETCH_MAX, Math.min(FAB_STRETCH_MAX, fabStretchY.value));
    return {
      transform: [
        { scale: fabScale.value },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });
  const fabTouchStartRef = useRef({ x: 0, y: 0 });

  const fabRotation = useSharedValue(0); // 0 = plus, 45 = X
  const fabIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotation.value}deg` }],
  }));
  const fabStarStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-fabRotation.value}deg` }], // mirror of plus: same 45° magnitude, opposite direction
  }));

  // Popup: keyframed fade (0→1 progress) + spring position on content only
  const popupFade = useSharedValue(0);
  const popupPop = useSharedValue(0);
  const popupOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      popupFade.value,
      [0, 0.18, 0.42, 0.65, 0.85, 1],
      [0, 0.25, 0.72, 0.92, 0.98, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });
  const popupContentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      popupFade.value,
      [0, 0.18, 0.42, 0.65, 0.85, 1],
      [0, 0.25, 0.72, 0.92, 0.98, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(popupPop.value, [0, 1], [32, 0], Extrapolation.CLAMP);
    const scale = interpolate(popupPop.value, [0, 1], [0.9, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Staggered pop per card (0–3): smooth entrance, no bounce
  const popupCard0 = useSharedValue(0);
  const popupCard1 = useSharedValue(0);
  const popupCard2 = useSharedValue(0);
  const popupCard3 = useSharedValue(0);
  const popupCardHover0 = useSharedValue(0);
  const popupCardHover1 = useSharedValue(0);
  const popupCardHover2 = useSharedValue(0);
  const popupCardHover3 = useSharedValue(0);
  const popupCardPress0 = useSharedValue(1);
  const popupCardPress1 = useSharedValue(1);
  const popupCardPress2 = useSharedValue(1);
  const popupCardPress3 = useSharedValue(1);
  const POPUP_CARD_STAGGER_MS = 55;
  const HOVER_EASING = Easing.inOut(Easing.sin);
  const HOVER_STAGGER_MS = 320; // cards start hover slightly offset so not one block
  const POPUP_CARD_PRESS_DURATION = 100;
  const popupCardStyle = (card: 0 | 1 | 2 | 3) =>
    useAnimatedStyle(() => {
      const v = card === 0 ? popupCard0.value : card === 1 ? popupCard1.value : card === 2 ? popupCard2.value : popupCard3.value;
      const y = interpolate(v, [0, 1], [20, 0], Extrapolation.CLAMP);
      const s = interpolate(v, [0, 1], [0.82, 1], Extrapolation.CLAMP);
      const o = interpolate(v, [0, 0.6, 1], [0, 0.7, 1], Extrapolation.CLAMP);
      const h = card === 0 ? popupCardHover0.value : card === 1 ? popupCardHover1.value : card === 2 ? popupCardHover2.value : popupCardHover3.value;
      const hoverY = interpolate(h, [0, 1], [0, -4], Extrapolation.CLAMP);
      const p = card === 0 ? popupCardPress0.value : card === 1 ? popupCardPress1.value : card === 2 ? popupCardPress2.value : popupCardPress3.value;
      return { opacity: o, transform: [{ translateY: y + hoverY }, { scale: s * p }] };
    });
  const popupCardStyle0 = popupCardStyle(0);
  const popupCardStyle1 = popupCardStyle(1);
  const popupCardStyle2 = popupCardStyle(2);
  const popupCardStyle3 = popupCardStyle(3);

  const isEaten = useSharedValue(0);
  const rollTrigger = useSharedValue(0);

  const leftLabelOp = useSharedValue(1);
  const eatenLabelOp = useSharedValue(0);

  useAnimatedReaction(
    () => isEaten.value,
    (curr) => {
      leftLabelOp.value = withTiming(curr === 0 ? 1 : 0, { duration: 150 });
      eatenLabelOp.value = withTiming(curr === 1 ? 1 : 0, { duration: 150 });
    },
  );

  const leftLabelStyle = useAnimatedStyle(() => ({ opacity: leftLabelOp.value }));
  const eatenLabelStyle = useAnimatedStyle(() => ({ opacity: eatenLabelOp.value }));

  // ── New food-logging state ──
  const [showChoicePopup, setShowChoicePopup] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ai' | 'barcode' | 'label'>('ai');
  const cameraRef = useRef<any>(null);
  const clickSoundRef = useRef<Audio.Sound | null>(null);
  const tapSoundRef = useRef<Audio.Sound | null>(null);
  const popupOpenSoundRef = useRef<Audio.Sound | null>(null);
  const popupAmbientSoundRef = useRef<Audio.Sound | null>(null);
  const popupAmbientFadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fabPressInSoundRef = useRef<Audio.Sound | null>(null);
  const fabPressOutSoundRef = useRef<Audio.Sound | null>(null);
  const cardPressInSoundRef = useRef<Audio.Sound | null>(null);
  const cardPressOutSoundRef = useRef<Audio.Sound | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [aiPhotoBase64, setAiPhotoBase64] = useState<string | null>(null);
  const [aiDescription, setAiDescription] = useState('');
  const [showAiDescribe, setShowAiDescribe] = useState(false);
  const [showSavedFoods, setShowSavedFoods] = useState(false);
  const [savedFoodsList, setSavedFoodsList] = useState<SavedFood[]>([]);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [foodSearchResults, setFoodSearchResults] = useState<ParsedNutrition[]>([]);
  const [foodSearchLoading, setFoodSearchLoading] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showFlickerLogo, setShowFlickerLogo] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lastFlickerRef = useRef(0);
  const flickerTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const darkLogoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const IDLE_MS = 10000; // flicker after 10s idle
  const DARK_LOGO_HOLD_MS = 10000; // after flickers, hold dark logo for 10s then back to main
  const FLICKER_COOLDOWN_MS = 8000;
  const LOGO_RAPID_PRESS_COUNT = 10;
  const LOGO_RAPID_WINDOW_MS = 2500;
  const logoRapidPressCountRef = useRef(0);
  const logoRapidWindowStartRef = useRef(0);
  // Quick flickers: [showAltMs, showMainMs] pairs; then we hold alt for 10s
  const FLICKER_SEQUENCE: [number, number][] = [[100, 70], [180, 90], [120, 80]];
  const reportActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (darkLogoTimeoutRef.current) {
      clearTimeout(darkLogoTimeoutRef.current);
      darkLogoTimeoutRef.current = null;
    }
    setShowFlickerLogo(false);
  }, []);

  const runFlickerThenHold = useCallback(() => {
    flickerTimeoutsRef.current.forEach(clearTimeout);
    flickerTimeoutsRef.current = [];
    if (darkLogoTimeoutRef.current) clearTimeout(darkLogoTimeoutRef.current);
    let delay = 0;
    FLICKER_SEQUENCE.forEach(([onMs, offMs]) => {
      flickerTimeoutsRef.current.push(setTimeout(() => setShowFlickerLogo(true), delay));
      delay += onMs;
      flickerTimeoutsRef.current.push(setTimeout(() => setShowFlickerLogo(false), delay));
      delay += offMs;
    });
    // After the flickers, show dark logo for 10s then revert to main without flickering
    flickerTimeoutsRef.current.push(setTimeout(() => {
      setShowFlickerLogo(true);
      darkLogoTimeoutRef.current = setTimeout(() => {
        setShowFlickerLogo(false);
        darkLogoTimeoutRef.current = null;
        lastFlickerRef.current = Date.now(); // so idle doesn't re-trigger flicker right after revert
      }, DARK_LOGO_HOLD_MS);
    }, delay));
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const idleLongEnough = now - lastActivityRef.current >= IDLE_MS;
      const cooldownPassed = now - lastFlickerRef.current >= FLICKER_COOLDOWN_MS;
      const notInDarkHold = darkLogoTimeoutRef.current == null; // don't interrupt 10s revert
      if (idleLongEnough && cooldownPassed && notInDarkHold) {
        lastFlickerRef.current = now;
        runFlickerThenHold();
      }
    }, 600);
    return () => {
      clearInterval(t);
      flickerTimeoutsRef.current.forEach(clearTimeout);
      if (darkLogoTimeoutRef.current) clearTimeout(darkLogoTimeoutRef.current);
    };
  }, [runFlickerThenHold]);

  // Tab-bar pill dimensions for FAB positioning
  const PILL_BOTTOM = Platform.OS === 'ios' ? 28 : 12;
  const PILL_HEIGHT = Platform.OS === 'ios' ? Math.round(64 * 1.1) : Math.round(56 * 1.1);

  // Add Meal Form State
  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [mealImage, setMealImage] = useState<string | undefined>();

  // Edit Goals Form State
  const [editCalories, setEditCalories] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [editWater, setEditWater] = useState('');

  // Reload from storage whenever this tab is focused or viewing date changes
  const loadData = useCallback(async () => {
    const userSettings = await getUserSettings();
    setSettings(userSettings);
    const date = viewingDate;
    const log = await getNutritionLogByDate(date);
    if (log) {
      setTodayLog(log);
    } else {
      const newLog: NutritionLog = {
        id: generateId(),
        date,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        water: 0,
        meals: [],
      };
      await saveNutritionLog(newLog);
      setTodayLog(newLog);
    }
  }, [viewingDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const prevViewingDateRef = useRef(viewingDate);
  // Load the selected day's log when user taps a different date (not on initial mount)
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/24d86888-ef82-444e-aad8-90b62a37b0c8', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'nutrition.tsx:viewingDate', message: 'viewingDate effect', data: { hypothesisId: 'H4', viewingDate, prev: prevViewingDateRef.current }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    if (prevViewingDateRef.current !== viewingDate) {
      prevViewingDateRef.current = viewingDate;
      loadData();
    }
  }, [viewingDate, loadData]);

  // Also reload when app comes back from background (e.g. after switching apps)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') loadData();
    });
    return () => sub.remove();
  }, [loadData]);

  const handleSelectDate = useCallback((dateString: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/24d86888-ef82-444e-aad8-90b62a37b0c8', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'nutrition.tsx:handleSelectDate', message: 'user selected date', data: { hypothesisId: 'H1', dateString }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion
    setViewingDate(dateString);
  }, []);

  // Load sounds: tap, click, popup-open, popup-ambient, fab in/out (0213(3)/(4)), card in/out (0213(5)/(6))
  useEffect(() => {
    let clickSound: Audio.Sound | null = null;
    let tapSound: Audio.Sound | null = null;
    let popupOpenSound: Audio.Sound | null = null;
    let popupAmbientSound: Audio.Sound | null = null;
    let fabPressInSound: Audio.Sound | null = null;
    let fabPressOutSound: Audio.Sound | null = null;
    let cardPressInSound: Audio.Sound | null = null;
    let cardPressOutSound: Audio.Sound | null = null;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false, // respect silent mode – no sounds when muted
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound: sClick } = await Audio.Sound.createAsync(
          require('../../assets/sounds/click.mp4')
        );
        await sClick.setVolumeAsync(0.64); // 20% lower than 0.8
        clickSound = sClick;
        clickSoundRef.current = sClick;

        const { sound: sTap } = await Audio.Sound.createAsync(
          require('../../assets/sounds/tap.mp4')
        );
        await sTap.setVolumeAsync(0.64); // 20% lower than 0.8
        tapSound = sTap;
        tapSoundRef.current = sTap;

        const { sound: sPopup } = await Audio.Sound.createAsync(
          require('../../assets/sounds/popup-open.mp3')
        );
        await sPopup.setVolumeAsync(0.11); // popup open sound (20% of original 0.55)
        popupOpenSound = sPopup;
        popupOpenSoundRef.current = sPopup;

        const { sound: sAmbient } = await Audio.Sound.createAsync(
          require('../../assets/sounds/popup-ambient.mp3')
        );
        await sAmbient.setVolumeAsync(0.05); // 5% volume
        await sAmbient.setRateAsync(0.9, true); // 10% slower (pitchCorrect: true keeps pitch)
        popupAmbientSound = sAmbient;
        popupAmbientSoundRef.current = sAmbient;

        const { sound: sFabIn } = await Audio.Sound.createAsync(
          require('../../assets/sounds/fab-press-in.mp4')
        );
        await sFabIn.setVolumeAsync(0.2); // FAB click in 20% volume
        fabPressInSound = sFabIn;
        fabPressInSoundRef.current = sFabIn;

        const { sound: sFabOut } = await Audio.Sound.createAsync(
          require('../../assets/sounds/fab-press-out.mp4')
        );
        await sFabOut.setVolumeAsync(0.2); // FAB click out 20% volume
        fabPressOutSound = sFabOut;
        fabPressOutSoundRef.current = sFabOut;

        const { sound: sCardIn } = await Audio.Sound.createAsync(
          require('../../assets/sounds/card-press-in.mp4')
        );
        await sCardIn.setVolumeAsync(0.2); // card press-in 20% volume
        cardPressInSound = sCardIn;
        cardPressInSoundRef.current = sCardIn;

        const { sound: sCardOut } = await Audio.Sound.createAsync(
          require('../../assets/sounds/card-press-out.mp4')
        );
        await sCardOut.setVolumeAsync(0.2); // card press-out 20% volume
        cardPressOutSound = sCardOut;
        cardPressOutSoundRef.current = sCardOut;
      } catch (_) {
        // Assets missing or load failed – sounds will be silent
      }
    })();
    return () => {
      if (clickSound) clickSound.unloadAsync();
      if (tapSound) tapSound.unloadAsync();
      if (popupOpenSound) popupOpenSound.unloadAsync();
      if (popupAmbientSound) popupAmbientSound.unloadAsync();
      if (fabPressInSound) fabPressInSound.unloadAsync();
      if (fabPressOutSound) fabPressOutSound.unloadAsync();
      if (cardPressInSound) cardPressInSound.unloadAsync();
      if (cardPressOutSound) cardPressOutSound.unloadAsync();
      clickSoundRef.current = null;
      tapSoundRef.current = null;
      popupOpenSoundRef.current = null;
      popupAmbientSoundRef.current = null;
      fabPressInSoundRef.current = null;
      fabPressOutSoundRef.current = null;
      cardPressInSoundRef.current = null;
      cardPressOutSoundRef.current = null;
    };
  }, []);

  const playClickSound = useCallback(() => {
    const s = clickSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);

  const playTapSound = useCallback(() => {
    const s = tapSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);

  // Press = one sound, release = other sound (cards: 0213(5) in / 0213(6) out; FAB: 0213(3) in / 0213(4) out)
  const playCardPressInSound = useCallback(() => {
    const s = cardPressInSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);
  const playCardPressOutSound = useCallback(() => {
    const s = cardPressOutSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);
  const playFabPressInSound = useCallback(() => {
    const s = fabPressInSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);
  const playFabPressOutSound = useCallback(() => {
    const s = fabPressOutSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);

  const playPopupOpenSound = useCallback(() => {
    const s = popupOpenSoundRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);

  const playPopupAmbientSound = useCallback(() => {
    const s = popupAmbientSoundRef.current;
    if (!s) return;
    if (popupAmbientFadeIntervalRef.current) {
      clearInterval(popupAmbientFadeIntervalRef.current);
      popupAmbientFadeIntervalRef.current = null;
    }
    s.setVolumeAsync(0.05).catch(() => {}); // reset so audible every time popup opens (5%)
    s.setPositionAsync(0);
    s.playAsync().catch(() => {});
  }, []);

  // When user clicks out (closes popup), ambient fades to 0 over 0.5s then stops. While popup is open it keeps playing.
  const POPUP_AMBIENT_FADE_MS = 500;
  const POPUP_AMBIENT_FADE_STEP_MS = 50;
  const stopPopupAmbientSound = useCallback(() => {
    const s = popupAmbientSoundRef.current;
    if (!s) return;
    if (popupAmbientFadeIntervalRef.current) {
      clearInterval(popupAmbientFadeIntervalRef.current);
      popupAmbientFadeIntervalRef.current = null;
    }
    const startVol = 0.05;
    const steps = Math.max(1, Math.floor(POPUP_AMBIENT_FADE_MS / POPUP_AMBIENT_FADE_STEP_MS));
    const stepVol = startVol / steps;
    let current = startVol;
    popupAmbientFadeIntervalRef.current = setInterval(() => {
      current -= stepVol;
      if (current <= 0) {
        if (popupAmbientFadeIntervalRef.current) {
          clearInterval(popupAmbientFadeIntervalRef.current);
          popupAmbientFadeIntervalRef.current = null;
        }
        s.setVolumeAsync(0).then(() => s.stopAsync().catch(() => {})).catch(() => {});
        return;
      }
      s.setVolumeAsync(current).catch(() => {});
    }, POPUP_AMBIENT_FADE_STEP_MS);
  }, []);


  // ── Form helpers ──
  const resetMealForm = () => {
    setMealName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setMealImage(undefined);
  };

  const fillAndShowForm = (data: ParsedNutrition) => {
    setMealName(data.brand ? `${data.name} (${data.brand})` : data.name);
    setCalories(String(data.calories || ''));
    setProtein(String(data.protein || ''));
    setCarbs(String(data.carbs || ''));
    setFat(String(data.fat || ''));
    setShowAddMeal(true);
  };

  const handleAddMeal = async () => {
    if (!mealName || !calories) {
      Alert.alert('Error', 'Please enter at least meal name and calories');
      return;
    }

    const newMeal: Meal = {
      id: generateId(),
      name: mealName,
      mealType,
      time: new Date().toISOString(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      imageUri: mealImage,
    };

    if (todayLog) {
      const updatedLog: NutritionLog = {
        ...todayLog,
        calories: todayLog.calories + newMeal.calories,
        protein: todayLog.protein + newMeal.protein,
        carbs: todayLog.carbs + newMeal.carbs,
        fat: todayLog.fat + newMeal.fat,
        meals: [...todayLog.meals, newMeal],
      };

      await saveNutritionLog(updatedLog);
      setTodayLog(updatedLog);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Save to "saved foods" for quick re-logging
    await saveSavedFood({
      name: mealName,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    });

    // Reset form
    resetMealForm();
    setMealType('breakfast');
    setShowAddMeal(false);
  };

  // ── Choice popup: keyframed fade + spring pop + staggered cards (smooth entrance, no bounce) ──
  const popupHoverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runPopupHover = useCallback(() => {
    const up = withTiming(1, { duration: 2400, easing: HOVER_EASING });
    const down = withTiming(0, { duration: 2400, easing: HOVER_EASING });
    const cycle = withSequence(up, down);
    popupCardHover0.value = withDelay(0, cycle);
    popupCardHover1.value = withDelay(HOVER_STAGGER_MS, cycle);
    popupCardHover2.value = withDelay(HOVER_STAGGER_MS * 2, cycle);
    popupCardHover3.value = withDelay(HOVER_STAGGER_MS * 3, cycle);
  }, []);

  useEffect(() => {
    if (showChoicePopup) {
      popupFade.value = 0;
      popupPop.value = 0;
      popupCard0.value = 0;
      popupCard1.value = 0;
      popupCard2.value = 0;
      popupCard3.value = 0;
      popupCardHover0.value = 0;
      popupCardHover1.value = 0;
      popupCardHover2.value = 0;
      popupCardHover3.value = 0;
      popupFade.value = withTiming(1, { duration: 380 });
      popupPop.value = withSpring(1, { damping: 14, stiffness: 200, mass: 0.5 });
      // Smooth entrance (no bounce): timing instead of spring
      popupCard0.value = withDelay(0, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
      popupCard1.value = withDelay(POPUP_CARD_STAGGER_MS, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
      popupCard2.value = withDelay(POPUP_CARD_STAGGER_MS * 2, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
      popupCard3.value = withDelay(POPUP_CARD_STAGGER_MS * 3, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
      fabRotation.value = withSpring(45, FAB_ROTATION_SPRING); // plus → X, very subtle overshoot

      if (popupHoverIntervalRef.current) clearInterval(popupHoverIntervalRef.current);
      popupHoverIntervalRef.current = setInterval(runPopupHover, 5000);
      return () => {
        if (popupHoverIntervalRef.current) {
          clearInterval(popupHoverIntervalRef.current);
          popupHoverIntervalRef.current = null;
        }
      };
    } else {
      popupFade.value = 0;
      popupPop.value = 0;
      popupCard0.value = 0;
      popupCard1.value = 0;
      popupCard2.value = 0;
      popupCard3.value = 0;
      popupCardHover0.value = 0;
      popupCardHover1.value = 0;
      popupCardHover2.value = 0;
      popupCardHover3.value = 0;
      popupCardPress0.value = 1;
      popupCardPress1.value = 1;
      popupCardPress2.value = 1;
      popupCardPress3.value = 1;
      fabRotation.value = withSpring(0, FAB_ROTATION_SPRING); // X → plus, very subtle overshoot
      if (popupHoverIntervalRef.current) {
        clearInterval(popupHoverIntervalRef.current);
        popupHoverIntervalRef.current = null;
      }
    }
  }, [showChoicePopup, runPopupHover]);

  const closeChoicePopup = useCallback(() => {
    stopPopupAmbientSound();
    popupPop.value = withTiming(0, { duration: 90 });
    popupFade.value = withTiming(0, { duration: 120 }, (finished) => {
      if (finished) runOnJS(setShowChoicePopup)(false);
    });
    fabRotation.value = withSpring(0, FAB_ROTATION_SPRING); // X → plus in sync with cards leaving, very subtle overshoot
  }, [stopPopupAmbientSound]);

  const popupCardPressIn = useCallback((card: 0 | 1 | 2 | 3) => {
    const sv = card === 0 ? popupCardPress0 : card === 1 ? popupCardPress1 : card === 2 ? popupCardPress2 : popupCardPress3;
    sv.value = withTiming(0.99, { duration: POPUP_CARD_PRESS_DURATION, easing: Easing.out(Easing.cubic) });
  }, []);
  const popupCardPressOut = useCallback((card: 0 | 1 | 2 | 3) => {
    const sv = card === 0 ? popupCardPress0 : card === 1 ? popupCardPress1 : card === 2 ? popupCardPress2 : popupCardPress3;
    sv.value = withTiming(1, { duration: POPUP_CARD_PRESS_DURATION, easing: Easing.out(Easing.cubic) });
  }, []);

  // ── Choice popup handlers ──
  const handleChoiceSavedFoods = async () => {
    stopPopupAmbientSound();
    setShowChoicePopup(false);
    const foods = await getSavedFoods();
    setSavedFoodsList(foods);
    setShowSavedFoods(true);
  };

  const handleChoiceFoodDatabase = () => {
    stopPopupAmbientSound();
    setShowChoicePopup(false);
    setFoodSearchQuery('');
    setFoodSearchResults([]);
    setShowFoodSearch(true);
  };

  const handleChoiceScanFood = async () => {
    stopPopupAmbientSound();
    setShowChoicePopup(false);
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera Required', 'Camera permission is needed to scan food.');
        return;
      }
    }
    setCameraMode('ai');
    setCameraLoading(false);
    setShowAiDescribe(false);
    setAiPhotoBase64(null);
    setAiDescription('');
    setShowCamera(true);
  };

  const handleChoiceManual = () => {
    stopPopupAmbientSound();
    setShowChoicePopup(false);
    resetMealForm();
    setShowAddMeal(true);
  };

  // ── Barcode handler ──
  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (cameraMode !== 'barcode' || cameraLoading) return;
    setCameraLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const food = await searchByBarcode(result.data);
    setCameraLoading(false);
    if (food) {
      setShowCamera(false);
      fillAndShowForm(food);
    } else {
      Alert.alert('Not Found', 'Could not find that barcode. Try searching manually.', [
        { text: 'Search', onPress: () => { setShowCamera(false); handleChoiceFoodDatabase(); } },
        { text: 'OK' },
      ]);
    }
  };

  // ── Camera shutter (AI / Label) ──
  const handleCameraShutter = async () => {
    if (!cameraRef.current || cameraLoading) return;
    setCameraLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      if (!photo?.base64) { setCameraLoading(false); return; }
      if (cameraMode === 'label') {
        const parsed = await readNutritionLabel(photo.base64);
        setCameraLoading(false);
        if (parsed) { setShowCamera(false); fillAndShowForm(parsed); }
        else Alert.alert('Could not read label', 'Try again with better lighting or angle.');
      } else {
        setCameraLoading(false);
        setAiPhotoBase64(photo.base64);
        setShowAiDescribe(true);
      }
    } catch (e) {
      setCameraLoading(false);
      console.warn('Camera capture error:', e);
    }
  };

  // ── AI submit with description ──
  const handleAiSubmit = async () => {
    if (!aiPhotoBase64) return;
    setCameraLoading(true);
    const parsed = await analyzeFood(aiPhotoBase64, 'image/jpeg', aiDescription || undefined);
    setCameraLoading(false);
    if (parsed) {
      setShowCamera(false);
      setShowAiDescribe(false);
      fillAndShowForm(parsed);
    } else {
      Alert.alert('Analysis Failed', 'Could not analyze the photo. Try again.');
    }
  };

  // ── Food database search (debounced) ──
  const handleFoodSearch = useCallback((query: string) => {
    setFoodSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) { setFoodSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setFoodSearchLoading(true);
      const results = await searchFoods(query);
      setFoodSearchResults(results);
      setFoodSearchLoading(false);
    }, 500);
  }, []);

  const handleSelectFood = (food: ParsedNutrition) => {
    setShowFoodSearch(false);
    fillAndShowForm(food);
  };

  const handleSelectSavedFood = (food: SavedFood) => {
    setShowSavedFoods(false);
    fillAndShowForm({
      name: food.name, brand: food.brand || '', calories: food.calories,
      protein: food.protein, carbs: food.carbs, fat: food.fat, servingSize: '',
    });
  };

  const openEditGoals = () => {
    if (settings) {
      setEditCalories(String(settings.dailyGoals.calories));
      setEditProtein(String(settings.dailyGoals.protein));
      setEditCarbs(String(settings.dailyGoals.carbs));
      setEditFat(String(settings.dailyGoals.fat));
      setEditWater(String(settings.dailyGoals.water));
    }
    setShowEditGoals(true);
  };

  const handleSaveGoals = async () => {
    if (!settings) return;
    const updated: UserSettings = {
      ...settings,
      dailyGoals: {
        calories: parseInt(editCalories, 10) || settings.dailyGoals.calories,
        protein: parseInt(editProtein, 10) || settings.dailyGoals.protein,
        carbs: parseInt(editCarbs, 10) || settings.dailyGoals.carbs,
        fat: parseInt(editFat, 10) || settings.dailyGoals.fat,
        water: parseInt(editWater, 10) || settings.dailyGoals.water,
      },
    };
    await saveUserSettings(updated);
    setSettings(updated);
    setShowEditGoals(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const MEAL_TYPE_LABELS: Record<MealType, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
  };
  const MEAL_TYPE_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  const mealsByType = (todayLog?.meals ?? []).reduce<Record<MealType, Meal[]>>(
    (acc, meal) => {
      const type = meal.mealType ?? 'snack';
      if (!acc[type]) acc[type] = [];
      acc[type].push(meal);
      return acc;
    },
    { breakfast: [], lunch: [], dinner: [], snack: [] }
  );

  const handleAddWater = async (amount: number) => {
    if (todayLog) {
      const updatedLog: NutritionLog = {
        ...todayLog,
        water: todayLog.water + amount,
      };
      await saveNutritionLog(updatedLog);
      setTodayLog(updatedLog);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImagePickerAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setMealImage(result.assets[0].uri);
      // In production, you would upload this to your food recognition API
      // and auto-fill the macros
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Permission to access camera is required!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setMealImage(result.assets[0].uri);
      // In production, you would upload this to your food recognition API
    }
  };

  const calculateProgress = (current: number, goal: number) => {
    return Math.min(Math.round((current / goal) * 100), 100);
  };

  const insets = useSafeAreaInsets();
  const headerHeight = 44;
  const contentTopPadding = ((insets.top + headerHeight) / 2 + Spacing.md) * 1.2;

  // Calories left card: 349×136 dp, radius 16
  const CALORIES_CARD_WIDTH = 349;
  const CALORIES_CARD_HEIGHT = 136;
  const CALORIES_CARD_RADIUS = 16;

  // Macro cards (Protein, Carbs, Fat): 112×140 dp, radius 16
  const MACRO_CARD_WIDTH = 112;
  const MACRO_CARD_HEIGHT = 140;
  const MACRO_CARD_RADIUS = 16;

  // Carousel (horizontal paging between normal and flipped card layouts)
  const CAROUSEL_WIDTH = Dimensions.get('window').width - Spacing.md * 2;
  const handleCarouselScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    reportActivity();
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / CAROUSEL_WIDTH);
    setCardPage(page);
  };

  const TAP_SLOP = 20; // px – only commit toggle on release when finger moved less than this (larger for Mac/simulator)
  const cardTouchStart = useRef({ x: 0, y: 0 });
  const carouselDraggedRef = useRef(false); // set true when carousel scroll starts – prevents toggle on release

  const onCardPressIn = (e: { nativeEvent: { pageX: number; pageY: number } }) => {
    reportActivity();
    cardTouchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    carouselDraggedRef.current = false;
    playCardPressInSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cardScale.value = withTiming(0.99, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const onCardPressOut = (e: { nativeEvent: { pageX: number; pageY: number } }) => {
    const { x, y } = cardTouchStart.current;
    const dx = e.nativeEvent.pageX - x;
    const dy = e.nativeEvent.pageY - y;
    const moved = Math.sqrt(dx * dx + dy * dy);
    const wasDrag = carouselDraggedRef.current || moved >= TAP_SLOP;
    if (!wasDrag) {
      playCardPressOutSound();
      isEaten.value = isEaten.value === 0 ? 1 : 0;
      rollTrigger.value = rollTrigger.value + 1;
    }
    carouselDraggedRef.current = false;
    cardScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const onCarouselScrollBeginDrag = () => {
    reportActivity();
    carouselDraggedRef.current = true; // user is dragging carousel – don’t count release as tap
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: contentTopPadding },
        ]}
      >
        <View style={styles.pageHeaderRow}>
          <Pressable
            onPress={() => {
              const now = Date.now();
              if (now - logoRapidWindowStartRef.current > LOGO_RAPID_WINDOW_MS) {
                logoRapidPressCountRef.current = 0;
                logoRapidWindowStartRef.current = now;
              }
              logoRapidPressCountRef.current += 1;
              if (logoRapidPressCountRef.current >= LOGO_RAPID_PRESS_COUNT) {
                logoRapidPressCountRef.current = 0;
                logoRapidWindowStartRef.current = 0;
                lastFlickerRef.current = Date.now();
                runFlickerThenHold();
              }
            }}
            style={styles.pageHeaderLogoPressable}
          >
            <Image
              source={showFlickerLogo ? require('../../assets/logo-flicker.png') : require('../../assets/tmlsn-calories-logo.png')}
              style={styles.pageHeaderLogo}
              resizeMode="contain"
            />
          </Pressable>
        </View>
        <SwipeableWeekView
          weekWidth={WEEK_STRIP_PAGE_WIDTH}
          selectedDate={viewingDateAsDate}
          onDaySelect={(date) => handleSelectDate(toDateString(date))}
          initialDate={viewingDateAsDate}
          showHeader={false}
        />
        {/* Macro cards carousel – swipe left to reveal flipped layout */}
        {settings && todayLog && (
          <>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleCarouselScroll}
              onScrollBeginDrag={onCarouselScrollBeginDrag}
              scrollEventThrottle={16}
              style={{ width: CAROUSEL_WIDTH }}
            >
              {/* Page 1: Big card top, 3 small cards bottom */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                  <Animated.View style={cardScaleStyle}>
                    <Card style={[styles.caloriesLeftCard, { width: CALORIES_CARD_WIDTH, height: CALORIES_CARD_HEIGHT, borderRadius: CALORIES_CARD_RADIUS, alignSelf: 'center' }]}>
                      <View style={styles.caloriesLeftContent}>
                        <View style={styles.caloriesLeftTextWrap}>
                          <BlurRollNumber
                            leftValue={String(Math.max(0, settings.dailyGoals.calories - todayLog.calories))}
                            eatenValue={String(todayLog.calories)}
                            eatenSuffix={`/${settings.dailyGoals.calories}`}
                            isEaten={isEaten}
                            trigger={rollTrigger}
                            textStyle={styles.caloriesLeftValue}
                            suffixStyle={styles.caloriesEatenGoal}
                            height={40}
                          />
                          <View>
                            <Animated.View style={leftLabelStyle}><Text style={styles.caloriesLeftLabel}>calories left</Text></Animated.View>
                            <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.caloriesEatenLabel}>calories eaten</Text></Animated.View>
                          </View>
                        </View>
                        <View style={[styles.mainCardRing, { width: MAIN_CARD_RING_SIZE, height: MAIN_CARD_RING_SIZE, borderRadius: MAIN_CARD_RING_SIZE / 2 }]} />
                      </View>
                    </Card>
                  </Animated.View>
                </Pressable>
                <Animated.View style={[styles.threeCardsRow, cardScaleStyle]}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber
                          leftValue={`${Math.max(0, settings.dailyGoals.protein - todayLog.protein)}g`}
                          eatenValue={String(todayLog.protein)}
                          eatenSuffix={`/${settings.dailyGoals.protein}g`}
                          isEaten={isEaten}
                          trigger={rollTrigger}
                          textStyle={styles.macroLeftValue}
                          suffixStyle={styles.macroEatenGoal}
                          height={20}
                        />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>protein left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>protein eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber
                          leftValue={`${Math.max(0, settings.dailyGoals.carbs - todayLog.carbs)}g`}
                          eatenValue={String(todayLog.carbs)}
                          eatenSuffix={`/${settings.dailyGoals.carbs}g`}
                          isEaten={isEaten}
                          trigger={rollTrigger}
                          textStyle={styles.macroLeftValue}
                          suffixStyle={styles.macroEatenGoal}
                          height={20}
                        />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>carbs left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>carbs eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber
                          leftValue={`${Math.max(0, settings.dailyGoals.fat - todayLog.fat)}g`}
                          eatenValue={String(todayLog.fat)}
                          eatenSuffix={`/${settings.dailyGoals.fat}g`}
                          isEaten={isEaten}
                          trigger={rollTrigger}
                          textStyle={styles.macroLeftValue}
                          suffixStyle={styles.macroEatenGoal}
                          height={20}
                        />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>fat left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>fat eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                </Animated.View>
              </View>

              {/* Page 2: Electrolytes top, Health Score bottom (flipped layout) */}
              <View style={{ width: CAROUSEL_WIDTH }}>
                <Animated.View style={[styles.threeCardsRow, cardScaleStyle]}>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>sodium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>sodium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>potassium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>potassium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                  <Pressable onPressIn={onCardPressIn} onPressOut={onCardPressOut}>
                    <Card style={[styles.macroLeftCard, { width: MACRO_CARD_WIDTH, height: MACRO_CARD_HEIGHT, borderRadius: MACRO_CARD_RADIUS, flex: 0 }]}>
                      <View style={styles.macroLeftTextWrap}>
                        <BlurRollNumber leftValue={'\u2014mg'} eatenValue={'0'} eatenSuffix={'/\u2014mg'}
                          isEaten={isEaten} trigger={rollTrigger}
                          textStyle={styles.macroLeftValue} suffixStyle={styles.macroEatenGoal} height={20} />
                        <View style={styles.macroLabelRow}>
                          <Animated.View style={leftLabelStyle}><Text style={styles.macroLeftLabel}>magnesium left</Text></Animated.View>
                          <Animated.View style={[eatenLabelStyle, { position: 'absolute', top: 0, left: 0 }]}><Text style={styles.macroEatenLabel}>magnesium eaten</Text></Animated.View>
                        </View>
                      </View>
                      <View style={[styles.smallCardRing, { width: SMALL_CARD_RING_SIZE, height: SMALL_CARD_RING_SIZE, borderRadius: SMALL_CARD_RING_SIZE / 2 }]} />
                    </Card>
                  </Pressable>
                </Animated.View>
                <Pressable onPressIn={onCardPressIn} onPressOut={() => {
                  playCardPressOutSound();
                  cardScale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) });
                }}>
                  <Animated.View style={cardScaleStyle}>
                    <Card style={[styles.caloriesLeftCard, styles.healthScoreCard, { width: CALORIES_CARD_WIDTH, height: CALORIES_CARD_HEIGHT, borderRadius: CALORIES_CARD_RADIUS, alignSelf: 'center' }]}>
                      <View style={styles.healthScoreHeaderRow}>
                        <Text style={styles.healthScoreTitle}>health score</Text>
                      </View>
                      {(!todayLog?.meals?.length) && (
                        <View style={styles.healthScoreNaWrap} pointerEvents="none">
                          <Text style={styles.healthScoreNa} numberOfLines={1}>
                            N/A
                          </Text>
                        </View>
                      )}
                      <View style={styles.healthScoreBarTrack}>
                        <View style={styles.healthScoreBarFill} />
                      </View>
                    </Card>
                  </Animated.View>
                </Pressable>
              </View>
            </ScrollView>

            {/* Pagination dots */}
            <View style={styles.paginationDots}>
              <View style={[styles.dot, cardPage === 0 && styles.dotActive]} />
              <View style={[styles.dot, cardPage === 1 && styles.dotActive]} />
            </View>
          </>
        )}

        {/* Recently uploaded – title + card same size as calories left */}
        <Text style={styles.recentlyUploadedTitle}>Recently uploaded</Text>
        <Card style={[styles.caloriesLeftCard, styles.recentlyUploadedCard, { minHeight: CARD_UNIFIED_HEIGHT }]} />
      </ScrollView>

      {/* Floating Action Button (FAB) — 24px above tab bar pill; hold + drag stretches minimally in drag direction */}
      <View
        style={[styles.fabTouchable, { bottom: PILL_BOTTOM + PILL_HEIGHT + 24 }]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          reportActivity();
          playFabPressInSound();
          fabTouchStartRef.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          fabScale.value = withTiming(FAB_PRESS_SCALE, { duration: FAB_PRESS_DURATION_MS, easing: FAB_PRESS_EASING });
        }}
        onResponderMove={(e) => {
          const { x: startX, y: startY } = fabTouchStartRef.current;
          const dx = e.nativeEvent.pageX - startX;
          const dy = e.nativeEvent.pageY - startY;
          fabStretchX.value = Math.max(-FAB_STRETCH_MAX, Math.min(FAB_STRETCH_MAX, dx * FAB_STRETCH_FACTOR));
          fabStretchY.value = Math.max(-FAB_STRETCH_MAX, Math.min(FAB_STRETCH_MAX, dy * FAB_STRETCH_FACTOR));
        }}
        onResponderRelease={() => {
          playFabPressOutSound();
          fabRotation.value = withSpring(45, FAB_ROTATION_SPRING);
          fabScale.value = withTiming(1, { duration: FAB_RETURN_DURATION_MS, easing: Easing.out(Easing.cubic) });
          fabStretchX.value = withTiming(0, { duration: FAB_RETURN_DURATION_MS, easing: Easing.out(Easing.cubic) });
          fabStretchY.value = withTiming(0, { duration: FAB_RETURN_DURATION_MS, easing: Easing.out(Easing.cubic) });
          setShowChoicePopup(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          playPopupOpenSound();
          playPopupAmbientSound();
        }}
      >
        <Animated.View style={[styles.fab, fabScaleStyle]}>
          <Animated.View style={[styles.fabStarWrap, fabStarStyle]}>
            <Image source={require('../../assets/fab-star.png')} style={styles.fabStarImg} resizeMode="contain" />
          </Animated.View>
          <Animated.View style={[styles.fabIconWrap, fabIconStyle]}>
            <View style={styles.fabPlusH} />
            <View style={styles.fabPlusV} />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Choice Popup — 4 cards: saved foods, food database, scan food, manual entry — positioned just above FAB */}
      <Modal visible={showChoicePopup} animationType="none" transparent onRequestClose={closeChoicePopup}>
        <Pressable style={styles.popupOverlayTouch} onPress={closeChoicePopup}>
          <Animated.View style={[styles.popupOverlay, popupOverlayStyle]}>
          <Animated.View style={[styles.popupGridWrap, popupContentStyle, { paddingBottom: PILL_BOTTOM + PILL_HEIGHT + 24 + 56 + 16 }]}>
          <View style={styles.popupGrid}>
            <View style={styles.popupGridRow}>
              <Animated.View style={popupCardStyle0}>
                <TouchableOpacity
                  style={styles.popupCard}
                  onPress={handleChoiceSavedFoods}
                  onPressIn={() => popupCardPressIn(0)}
                  onPressOut={() => popupCardPressOut(0)}
                  activeOpacity={1}
                >
                  <Text style={styles.popupCardLabel}>saved foods</Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={popupCardStyle1}>
                <TouchableOpacity
                  style={styles.popupCard}
                  onPress={handleChoiceFoodDatabase}
                  onPressIn={() => popupCardPressIn(1)}
                  onPressOut={() => popupCardPressOut(1)}
                  activeOpacity={1}
                >
                  <Text style={styles.popupCardLabel}>search food</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
            <View style={styles.popupGridRow}>
              <Animated.View style={popupCardStyle2}>
                <TouchableOpacity
                  style={styles.popupCard}
                  onPress={handleChoiceScanFood}
                  onPressIn={() => popupCardPressIn(2)}
                  onPressOut={() => popupCardPressOut(2)}
                  activeOpacity={1}
                >
                  <Text style={styles.popupCardLabel}>scan food</Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={popupCardStyle3}>
                <TouchableOpacity
                  style={styles.popupCard}
                  onPress={handleChoiceManual}
                  onPressIn={() => popupCardPressIn(3)}
                  onPressOut={() => popupCardPressOut(3)}
                  activeOpacity={1}
                >
                  <Text style={styles.popupCardLabel}>manual entry</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
          </Animated.View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Unified Camera — AI / Barcode / Food Label */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={() => { setShowCamera(false); setShowAiDescribe(false); }}>
        <View style={styles.scannerContainer}>
          {permission?.granted && !showAiDescribe && (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={
                cameraMode === 'barcode'
                  ? { barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }
                  : { barcodeTypes: [] }
              }
              onBarcodeScanned={cameraMode === 'barcode' && !cameraLoading ? handleBarCodeScanned : undefined}
            />
          )}
          {showAiDescribe && (
            <View style={styles.aiDescribeOverlay}>
              <Text style={styles.aiDescribeTitle}>Describe your food</Text>
              <Text style={styles.aiDescribeHint}>Optional — helps the AI estimate better</Text>
              <TextInput
                style={styles.aiDescribeInput}
                placeholder="e.g. grilled chicken breast with rice"
                placeholderTextColor="#888"
                value={aiDescription}
                onChangeText={setAiDescription}
                multiline
              />
              <TouchableOpacity style={styles.aiDescribeButton} onPress={handleAiSubmit} disabled={cameraLoading}>
                {cameraLoading ? <ActivityIndicator color="#2F3031" /> : <Text style={styles.aiDescribeButtonText}>Analyze</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowAiDescribe(false); setAiPhotoBase64(null); }} style={{ marginTop: 12 }}>
                <Text style={{ color: '#C6C6C6', fontFamily: CardFont.family, fontSize: 14 }}>Retake</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.cameraTopBar}>
            <TouchableOpacity onPress={() => { setShowCamera(false); setShowAiDescribe(false); }}>
              <Text style={styles.cameraCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          {!showAiDescribe && (
            <View style={styles.cameraModeRow}>
              {(['ai', 'barcode', 'label'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.cameraModeBubble, cameraMode === mode && styles.cameraModeBubbleActive]}
                  onPress={() => setCameraMode(mode)}
                >
                  <Text style={[styles.cameraModeBubbleText, cameraMode === mode && styles.cameraModeBubbleTextActive]}>
                    {mode === 'ai' ? 'Scan Food (AI)' : mode === 'barcode' ? 'Barcode' : 'Food Label'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!showAiDescribe && cameraMode !== 'barcode' && (
            <View style={styles.cameraShutterRow}>
              {cameraLoading ? (
                <ActivityIndicator size="large" color="#C6C6C6" />
              ) : (
                <TouchableOpacity style={styles.shutterButton} onPress={handleCameraShutter}>
                  <View style={styles.shutterButtonInner} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {!showAiDescribe && cameraMode === 'barcode' && cameraLoading && (
            <View style={styles.cameraShutterRow}>
              <ActivityIndicator size="large" color="#C6C6C6" />
            </View>
          )}
        </View>
      </Modal>

      {/* Saved Foods Modal */}
      <Modal visible={showSavedFoods} animationType="slide" transparent onRequestClose={() => setShowSavedFoods(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Saved Foods</Text>
            {savedFoodsList.length === 0 ? (
              <Text style={styles.emptyText}>No saved foods yet. Foods you log will appear here.</Text>
            ) : (
              <FlatList
                data={savedFoodsList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.foodSearchItem} onPress={() => handleSelectSavedFood(item)}>
                    <Text style={styles.foodSearchName}>{item.name}</Text>
                    {item.brand ? <Text style={styles.foodSearchBrand}>{item.brand}</Text> : null}
                    <Text style={styles.foodSearchMacros}>
                      {item.calories} cal · {item.protein}p · {item.carbs}c · {item.fat}f
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <Button title="Close" onPress={() => setShowSavedFoods(false)} variant="secondary" style={{ marginTop: Spacing.md }} textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }} />
          </View>
        </View>
      </Modal>

      {/* Food Database Search Modal */}
      <Modal visible={showFoodSearch} animationType="slide" transparent onRequestClose={() => setShowFoodSearch(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Search food</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search foods…"
              placeholderTextColor="#888"
              value={foodSearchQuery}
              onChangeText={handleFoodSearch}
              autoFocus
            />
            {foodSearchLoading && <ActivityIndicator style={{ marginVertical: 12 }} color="#C6C6C6" />}
            <FlatList
              data={foodSearchResults}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.foodSearchItem} onPress={() => handleSelectFood(item)}>
                  <Text style={styles.foodSearchName}>{item.name}</Text>
                  {item.brand ? <Text style={styles.foodSearchBrand}>{item.brand}</Text> : null}
                  <Text style={styles.foodSearchMacros}>
                    {item.calories} cal · {item.protein}p · {item.carbs}c · {item.fat}f
                    {item.servingSize ? ` · ${item.servingSize}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={!foodSearchLoading && foodSearchQuery.length > 0 ? <Text style={styles.emptyText}>No results found</Text> : null}
            />
            <Button title="Close" onPress={() => setShowFoodSearch(false)} variant="secondary" style={{ marginTop: Spacing.md }} textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }} />
          </View>
        </View>
      </Modal>

      {/* Meal Form Modal (Add Meal) */}
      <Modal
        visible={showAddMeal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddMeal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Meal</Text>

            <Text style={styles.inputLabel}>Meal type</Text>
            <View style={styles.mealTypeRow}>
              {(MEAL_TYPE_ORDER as MealType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.mealTypeChip,
                    mealType === type && styles.mealTypeChipActive,
                  ]}
                  onPress={() => setMealType(type)}
                >
                  <Text
                    style={[
                      styles.mealTypeChipText,
                      mealType === type && styles.mealTypeChipTextActive,
                    ]}
                  >
                    {MEAL_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input
              label="Meal Name"
              value={mealName}
              onChangeText={setMealName}
              placeholder="e.g., Breakfast, Chicken Salad"
              fontFamily={Font.regular}
            />

            <View style={styles.photoButtons}>
              <Button
                title="📷 Take Photo"
                onPress={takePhoto}
                variant="secondary"
                style={styles.photoButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
              <Button
                title="🖼️ Choose Photo"
                onPress={pickImage}
                variant="secondary"
                style={styles.photoButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
            </View>

            <Input
              label="Calories"
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
              placeholder="500"
              fontFamily={Font.regular}
            />

            <View style={styles.macroRow}>
              <Input
                label="Protein (g)"
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholder="30"
                containerStyle={styles.macroInput}
                fontFamily={Font.regular}
              />
              <Input
                label="Carbs (g)"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                placeholder="40"
                containerStyle={styles.macroInput}
                fontFamily={Font.regular}
              />
              <Input
                label="Fat (g)"
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
                placeholder="15"
                containerStyle={styles.macroInput}
                fontFamily={Font.regular}
              />
            </View>

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setShowAddMeal(false)}
                variant="secondary"
                style={styles.modalButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
              <Button
                title="Add Meal"
                onPress={handleAddMeal}
                style={styles.modalButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Goals Modal */}
      <Modal
        visible={showEditGoals}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditGoals(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Daily goals</Text>
            <Input
              label="Calories"
              value={editCalories}
              onChangeText={setEditCalories}
              keyboardType="numeric"
              placeholder="2500"
              fontFamily={Font.regular}
            />
            <Input
              label="Protein (g)"
              value={editProtein}
              onChangeText={setEditProtein}
              keyboardType="numeric"
              placeholder="150"
              fontFamily={Font.regular}
            />
            <Input
              label="Carbs (g)"
              value={editCarbs}
              onChangeText={setEditCarbs}
              keyboardType="numeric"
              placeholder="250"
              fontFamily={Font.regular}
            />
            <Input
              label="Fat (g)"
              value={editFat}
              onChangeText={setEditFat}
              keyboardType="numeric"
              placeholder="80"
              fontFamily={Font.regular}
            />
            <Input
              label="Water (oz)"
              value={editWater}
              onChangeText={setEditWater}
              keyboardType="numeric"
              placeholder="128"
              fontFamily={Font.regular}
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => setShowEditGoals(false)}
                variant="secondary"
                style={styles.modalButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
              <Button
                title="Save"
                onPress={handleSaveGoals}
                style={styles.modalButton}
                textStyle={{ fontFamily: Font.semiBold, color: Colors.primaryLight }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
  },
  contentContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  pageHeaderRow: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  pageHeaderLogo: {
    height: (Typography.h2 + 10) * 1.2 * 1.1,
    width: (Typography.h2 + 10) * 1.2 * 1.1,
  },
  pageHeaderLogoPressable: {},
  pageHeading: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2 * 1.2 * 1.1,
    color: Colors.primaryLight,
    letterSpacing: CardFont.letterSpacing * 0.95 * 0.95,
  },
  cardTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h2,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
    letterSpacing: HeadingLetterSpacing,
  },
  caloriesLeftCard: {
    paddingVertical: Spacing.md,
    paddingLeft: 22, // 22 from left edge of card to number
    paddingRight: 22, // 22 from circle right edge to card right edge
    marginBottom: Spacing.sm,
    justifyContent: 'center',
  },
  caloriesLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  caloriesLeftTextWrap: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    flex: 1,
    overflow: 'hidden',
  },
  caloriesLeftValue: {
    fontFamily: CardFont.family,
    fontSize: 36,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
    letterSpacing: 36 * -0.03, // -3% letter spacing (-1.08)
  },
  caloriesLeftLabel: {
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    marginTop: -3,
    letterSpacing: (CARD_LABEL_FONT_SIZE + 2) * -0.12,
  },
  caloriesEatenLabel: {
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    marginTop: -3,
    letterSpacing: (CARD_LABEL_FONT_SIZE + 2) * -0.12,
  },
  caloriesEatenGoal: {
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: CARD_LABEL_FONT_SIZE * -0.12,
  },
  mainCardRing: {
    borderWidth: 9,
    borderColor: 'rgba(198, 198, 198, 0.8)', // #C6C6C6, 80% opacity, ring stroke
    backgroundColor: 'transparent',
    marginLeft: Spacing.md,
    marginRight: 0,
  },
  threeCardsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    alignSelf: 'center',
  },
  macroLeftCard: {
    flex: 1,
    paddingTop: 17.5,
    paddingBottom: 17.5,
    paddingHorizontal: 11,
    marginVertical: 0,
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  macroLeftTextWrap: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    overflow: 'visible',
  },
  macroLeftValue: {
    fontFamily: CardFont.family,
    fontSize: 16,
    fontWeight: '500',
    color: CARD_NUMBER_COLOR,
    letterSpacing: CardFont.letterSpacing,
  },
  macroLeftLabel: {
    fontFamily: CardFont.family,
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    marginTop: Spacing.xs,
    letterSpacing: 10 * -0.12,
  },
  macroEatenLabel: {
    fontFamily: CardFont.family,
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    marginTop: Spacing.xs,
    letterSpacing: 10 * -0.12,
  },
  macroLabelRow: {
    minWidth: 72,
  },
  macroEatenGoal: {
    fontFamily: CardFont.family,
    fontSize: 10,
    color: CARD_LABEL_COLOR,
    letterSpacing: 10 * -0.12,
  },
  smallCardRing: {
    borderWidth: 6 * 0.99, // 1% less stroke (~5.94)
    borderColor: 'rgba(198, 198, 198, 0.8)', // #C6C6C6, 80% opacity, inside stroke
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginTop: Spacing.sm,
  },
  healthScoreCard: {
    justifyContent: 'flex-start',
    paddingTop: 24,
    paddingLeft: 16,
    overflow: 'visible',
  },
  healthScoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
  },
  healthScoreTitle: {
    fontFamily: CardFont.family,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 15 * -0.12, // -12%
  },
  healthScoreNaWrap: {
    position: 'absolute',
    top: 24,
    right: 15, // matches bar right edge (349 - 15 - 319 = 15)
    alignItems: 'flex-end',
  },
  healthScoreNa: {
    fontFamily: CardFont.family,
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0, // no negative spacing – prevents last-char clipping
  },
  healthScoreBarTrack: {
    position: 'absolute',
    top: 48,
    left: 15, // center 319-wide bar in 349 card
    width: 319,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(198, 198, 198, 0.2)', // darker uncomplete track
    overflow: 'hidden',
  },
  healthScoreBarFill: {
    width: '0%', // placeholder – 0% filled for now
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C6C6C6',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(198, 198, 198, 0.3)',
  },
  dotActive: {
    backgroundColor: 'rgba(198, 198, 198, 0.9)',
  },
  recentlyUploadedTitle: {
    fontFamily: CardFont.family,
    fontSize: Typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: CardFont.letterSpacing,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  recentlyUploadedCard: {
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  macrosContainer: {
    gap: Spacing.md,
  },
  macroItem: {
    marginBottom: Spacing.sm,
  },
  macroValue: {
    fontFamily: Font.bold,
    fontSize: Typography.dataValue,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
  },
  macroGoal: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  macroLabel: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.primaryLight + '30',
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.sm,
  },
  waterValue: {
    fontFamily: Font.bold,
    fontSize: Typography.dataValue,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
  },
  waterButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  waterButton: {
    flex: 1,
    backgroundColor: Colors.primaryLight + '20',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  waterButtonText: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
  editGoalsLink: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
  emptyText: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  mealSection: {
    marginBottom: Spacing.md,
  },
  mealSectionTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.label,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
    textTransform: 'capitalize',
    letterSpacing: HeadingLetterSpacing,
  },
  mealItem: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primaryLight + '20',
  },
  mealName: {
    fontFamily: Font.semiBold,
    fontSize: Typography.body,
    fontWeight: Typography.weights.semiBold,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
  },
  mealMacros: {
    fontFamily: Font.regular,
    fontSize: Typography.label,
    color: Colors.primaryLight,
  },
  // ── FAB ──
  fabTouchable: {
    position: 'absolute',
    alignSelf: 'center',
    width: 56,
    height: 56,
    zIndex: 100,
  },
  fab: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabStarWrap: {
    position: 'absolute',
    width: 58,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabStarImg: {
    width: '100%',
    height: '100%',
  },
  fabIconWrap: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPlusH: {
    position: 'absolute',
    width: 24,
    height: 3.6,
    borderRadius: 1.8,
    backgroundColor: '#2F3031',
  },
  fabPlusV: {
    position: 'absolute',
    width: 3.6,
    height: 24,
    borderRadius: 1.8,
    backgroundColor: '#2F3031',
  },
  // ── Choice Popup ──
  popupOverlayTouch: {
    flex: 1,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)', // 10% darker than 0.45
  },
  popupGridWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  popupGrid: {
    gap: 12,
  },
  popupGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  popupCard: {
    width: 174,
    height: 98,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#C6C6C6',
    paddingLeft: 12,
    paddingBottom: 12,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    ...Shadows.card,
  },
  popupCardLabel: {
    fontFamily: CardFont.family,
    fontSize: 16,
    fontWeight: '500',
    color: '#2F3031',
    letterSpacing: -0.105,
    textAlign: 'left',
  },
  // ── Camera ──
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraTopBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  cameraCloseText: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 16,
    color: '#C6C6C6',
  },
  cameraModeRow: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  cameraModeBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  cameraModeBubbleActive: {
    backgroundColor: '#C6C6C6',
  },
  cameraModeBubbleText: {
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    color: CARD_LABEL_COLOR,
    letterSpacing: CARD_LABEL_FONT_SIZE * -0.12,
  },
  cameraModeBubbleTextActive: {
    fontFamily: CardFont.family,
    fontSize: CARD_LABEL_FONT_SIZE + 2,
    fontWeight: '500',
    letterSpacing: CARD_LABEL_FONT_SIZE * -0.12,
    color: '#2F3031',
  },
  cameraShutterRow: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#C6C6C6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#C6C6C6',
  },
  // ── AI Describe ──
  aiDescribeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#2F3031',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 5,
  },
  aiDescribeTitle: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  aiDescribeHint: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 13,
    color: '#888',
    marginBottom: 20,
  },
  aiDescribeInput: {
    width: '100%',
    minHeight: 80,
    backgroundColor: '#3D3E3F',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontFamily: 'DMMono_400Regular',
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  aiDescribeButton: {
    backgroundColor: '#C6C6C6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  aiDescribeButtonText: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 16,
    color: '#2F3031',
  },
  // ── Food search items ──
  searchInput: {
    backgroundColor: '#3D3E3F',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontFamily: 'DMMono_400Regular',
    fontSize: 15,
    marginBottom: 12,
  },
  foodSearchItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(198,198,198,0.15)',
  },
  foodSearchName: {
    fontFamily: 'DMMono_500Medium',
    fontSize: 14,
    color: '#FFFFFF',
  },
  foodSearchBrand: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  foodSearchMacros: {
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: '#C6C6C6',
    marginTop: 4,
  },
  addButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.primaryDark,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '90%',
  },
  modalTitle: {
    fontFamily: Font.extraBold,
    fontSize: Typography.h1,
    fontWeight: Typography.weights.bold,
    color: Colors.primaryLight,
    marginBottom: Spacing.lg,
    letterSpacing: HeadingLetterSpacing,
  },
  inputLabel: {
    fontFamily: Font.extraBold,
    fontSize: Typography.label,
    color: Colors.primaryLight,
    marginBottom: Spacing.xs,
    letterSpacing: HeadingLetterSpacing,
  },
  mealTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  mealTypeChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight + '20',
  },
  mealTypeChipActive: {
    backgroundColor: Colors.accentBlue,
  },
  mealTypeChipText: {
    fontFamily: Font.regular,
    fontSize: Typography.body,
    color: Colors.primaryLight,
  },
  mealTypeChipTextActive: {
    fontFamily: Font.semiBold,
    color: Colors.primaryLight,
    fontWeight: Typography.weights.semiBold,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  photoButton: {
    flex: 1,
  },
  macroRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  macroInput: {
    flex: 1,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
});
