import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Colors, Typography } from '../../constants/theme';
import {
  Platform,
  Text,
  Image,
  View,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Animated as RNAnimated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { emitCardSelect, onStreakPopupState } from '../../utils/fabBridge';
import { StreakShiftContext } from '../../context/streakShiftContext';

// ── Pill constants ──
const PILL_LABEL_COLOR = '#C6C6C6';
const TAB_LABEL_STYLE: any = {
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: -0.10,
  color: PILL_LABEL_COLOR,
  marginTop: 4,
  lineHeight: 12,
};
const ICON_BOX_SIZE = 24;

const PILL_BOTTOM = 19;
const PILL_MARGIN_H = 19;
const PILL_HEIGHT = 57;
const PILL_RADIUS = 28;
const PILL_BG_COLOR = '#2E2F30';
const PILL_BORDER_COLOR = '#4A4B4C';

// Selected-tab bubble
const SELECTED_TAB_PILL_COLOR = 'rgba(108, 108, 108, 0.6)';
const SELECTED_TAB_PILL_RADIUS = 28;

// ── Calculated pill slide positions ──
const SCREEN_WIDTH = Dimensions.get('window').width;
const TAB_BAR_INNER_WIDTH = SCREEN_WIDTH - 2 * PILL_MARGIN_H;
const BORDER_INSET = 1; // 1px gradient border
const PILL_CONTENT_WIDTH = TAB_BAR_INNER_WIDTH - 2 * BORDER_INSET; // usable area inside border
const TAB_SLOT_WIDTH = PILL_CONTENT_WIDTH / 5;
const SELECTED_TAB_PILL_H_PAD = 3; // horizontal padding each side within slot
const SELECTED_TAB_PILL_WIDTH = TAB_SLOT_WIDTH - 2 * SELECTED_TAB_PILL_H_PAD;
const SELECTED_TAB_PILL_V_PAD = 4; // vertical padding from inner edge
const SELECTED_TAB_PILL_HEIGHT = PILL_HEIGHT - 2 * BORDER_INSET - 2 * SELECTED_TAB_PILL_V_PAD;
const getTabPillX = (index: number) =>
  BORDER_INSET + index * TAB_SLOT_WIDTH + SELECTED_TAB_PILL_H_PAD;

// ── Popup card constants ──
const POPUP_CARD_WIDTH = 173;
const POPUP_CARD_HEIGHT = 87;
const POPUP_CARD_RADIUS = 16;
const POPUP_CARD_GAP = 12;
const POPUP_CARD_STAGGER_MS = 55;
const POPUP_CARD_FONT = 'DMMono_500Medium';

// ── Tab definitions (order matches Tabs.Screen order: index hidden, nutrition=0, workout=1, fab-action=2, prompts=3, profile=4) ──
const TAB_META: Record<string, { label: string; icon: React.ReactNode; tabIndex: number }> = {
  nutrition: {
    label: 'home.',
    tabIndex: 0,
    icon: (
      <Image
        source={require('../../assets/home-tab-icon.png')}
        style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE }}
        resizeMode="contain"
      />
    ),
  },
  workout: {
    label: 'workout.',
    tabIndex: 1,
    icon: (
      <Image
        source={require('../../assets/workout-tab-icon.png')}
        style={{ width: ICON_BOX_SIZE * 1.2, height: ICON_BOX_SIZE * 1.2, marginTop: 2 }}
        resizeMode="contain"
      />
    ),
  },
  prompts: {
    label: 'explore.',
    tabIndex: 3,
    icon: (
      <Image
        source={require('../../assets/explore-tab-icon.png')}
        style={{ width: ICON_BOX_SIZE * 1.11, height: ICON_BOX_SIZE * 1.11 }}
        resizeMode="contain"
      />
    ),
  },
  profile: {
    label: 'progress.',
    tabIndex: 4,
    icon: (
      <Image
        source={require('../../assets/profile-tab-icon.png')}
        style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE }}
        resizeMode="contain"
      />
    ),
  },
};

// ── Tab button helper (no static selected background — the sliding pill handles it) ──
function TabButton({
  label,
  icon,
  selected,
  onPress,
  scaleAnim,
  onTabPressIn,
  onTabPressOut,
  onTabLongPress,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onPress?: () => void;
  scaleAnim?: RNAnimated.Value;
  onTabPressIn?: () => void;
  onTabPressOut?: () => void;
  onTabLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onTabPressIn}
      onPressOut={onTabPressOut}
      onLongPress={selected ? onTabLongPress : undefined}
      delayLongPress={250}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      <RNAnimated.View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          transform: scaleAnim ? [{ scale: scaleAnim }] : [],
        }}
      >
        <View style={{ width: ICON_BOX_SIZE, height: ICON_BOX_SIZE, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
        <Text style={TAB_LABEL_STYLE}>{label}</Text>
      </RNAnimated.View>
    </Pressable>
  );
}

const MODAL_ROUTES = ['food-action-modal', 'start-empty-workout-modal', 'tmlsn-routines-modal', 'your-routines-modal'];
const isModalPath = (path: string) => MODAL_ROUTES.some((r) => path.includes(r));

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const isNutritionSelected = pathname.includes('nutrition');
  const isWorkoutSelected = pathname.includes('workout');
  const isPromptsSelected = pathname.includes('prompts');
  const isProfileSelected = pathname.includes('profile');

  const lastTabIndexRef = useRef(0);
  const openedFromWorkoutRef = useRef(false);
  const fabOpenedFromTabIndexRef = useRef(0);
  // State (not ref) so tab bar re-renders when we open workout page from another tab — highlight stays on that tab
  const [tabHighlightLock, setTabHighlightLock] = useState<number | null>(null);
  const tabIndexFromPath = isNutritionSelected ? 0 : isWorkoutSelected ? 1 : isPromptsSelected ? 3 : isProfileSelected ? 4 : 0;
  if (!isModalPath(pathname)) lastTabIndexRef.current = tabIndexFromPath;
  const activeTabIndex = tabHighlightLock !== null ? tabHighlightLock : (isModalPath(pathname) ? lastTabIndexRef.current : tabIndexFromPath);

  // Clear highlight lock when leaving workout stack (e.g. Back to home)
  useEffect(() => {
    if (!pathname.startsWith('/workout')) setTabHighlightLock(null);
  }, [pathname]);

  const clearTabHighlightLock = useCallback(() => {
    setTabHighlightLock(null);
  }, []);

  // ══════════════════════════════════════════
  // FAB animation state
  // ══════════════════════════════════════════
  const fabScaleAnim = useRef(new RNAnimated.Value(1)).current;
  const fabRotAnim = useRef(new RNAnimated.Value(0)).current;
  const [fabOpen, setFabOpen] = useState(false);

  // ══════════════════════════════════════════
  // Sliding selected pill
  // ══════════════════════════════════════════
  const pillTranslateX = useRef(new RNAnimated.Value(getTabPillX(0))).current;
  const pillScaleX = useRef(new RNAnimated.Value(1)).current;
  const pillScaleY = useRef(new RNAnimated.Value(1)).current;
  const pillOpacity = useRef(new RNAnimated.Value(1)).current;

  // Single source of truth: one shift value for tab bar + nutrition content (same rate, in sync)
  const streakShiftX = useRef(new RNAnimated.Value(0)).current;
  const streakOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STREAK_SHIFT_LEFT_PX = -12;
  const STREAK_SHIFT_RIGHT_PX = 24;
  const STREAK_OPEN_DELAY_MS = 40; // match panel slide start
  useEffect(() => {
    const unsub = onStreakPopupState((open) => {
      if (open) {
        if (streakOpenTimeoutRef.current) clearTimeout(streakOpenTimeoutRef.current);
        streakOpenTimeoutRef.current = setTimeout(() => {
          streakOpenTimeoutRef.current = null;
          // Diagnostic: listener to see if we ever reach the "right" step (value >= 20)
          const listenerId = streakShiftX.addListener(({ value }: { value: number }) => {
            if (value >= 20) console.log('[StreakShift] value reached right', value);
          });
          RNAnimated.sequence([
            RNAnimated.timing(streakShiftX, {
              toValue: STREAK_SHIFT_LEFT_PX,
              duration: 50,
              useNativeDriver: true,
            }),
            RNAnimated.timing(streakShiftX, {
              toValue: STREAK_SHIFT_RIGHT_PX,
              duration: 120,
              useNativeDriver: true,
            }),
          ]).start(({ finished }) => {
            streakShiftX.removeListener(listenerId);
            console.log('[StreakShift] open sequence finished', finished);
          });
        }, STREAK_OPEN_DELAY_MS);
      } else {
        if (streakOpenTimeoutRef.current) {
          clearTimeout(streakOpenTimeoutRef.current);
          streakOpenTimeoutRef.current = null;
        }
        RNAnimated.timing(streakShiftX, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }).start();
      }
    });
    return () => {
      unsub();
      if (streakOpenTimeoutRef.current) clearTimeout(streakOpenTimeoutRef.current);
    };
  }, [streakShiftX]);

  useEffect(() => {
    RNAnimated.spring(pillTranslateX, {
      toValue: getTabPillX(activeTabIndex),
      damping: 16,
      stiffness: 130,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }, [activeTabIndex, pillTranslateX]);

  // ══════════════════════════════════════════
  // Bar response to FAB open/close
  // ══════════════════════════════════════════
  const barScale = useRef(new RNAnimated.Value(1)).current;
  const barTranslateY = useRef(new RNAnimated.Value(0)).current;
  const barOpacity = useRef(new RNAnimated.Value(1)).current;

  // ══════════════════════════════════════════
  // Per-tab icon tap micro-interactions
  // ══════════════════════════════════════════
  const tabScales = useRef([
    new RNAnimated.Value(1), // tab 0 (nutrition)
    new RNAnimated.Value(1), // tab 1 (workout)
    new RNAnimated.Value(1), // tab 2 (FAB — unused)
    new RNAnimated.Value(1), // tab 3 (prompts)
    new RNAnimated.Value(1), // tab 4 (profile)
  ]).current;

  const handleTabPressIn = useCallback((tabIndex: number) => {
    RNAnimated.timing(tabScales[tabIndex], {
      toValue: 0.92,
      duration: 80,
      useNativeDriver: true,
    }).start();
  }, [tabScales]);

  const handleTabPressOut = useCallback((tabIndex: number) => {
    RNAnimated.spring(tabScales[tabIndex], {
      toValue: 1,
      damping: 20,
      stiffness: 200,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
    // Also reset pill swell (no-op if wasn't swelled)
    RNAnimated.parallel([
      RNAnimated.spring(pillScaleX, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
      RNAnimated.spring(pillScaleY, { toValue: 1, damping: 14, stiffness: 120, useNativeDriver: true }),
    ]).start();
  }, [tabScales, pillScaleX, pillScaleY]);

  const handleTabLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    RNAnimated.parallel([
      RNAnimated.spring(pillScaleX, { toValue: 1.06, damping: 12, stiffness: 100, useNativeDriver: true }),
      RNAnimated.spring(pillScaleY, { toValue: 1.10, damping: 12, stiffness: 100, useNativeDriver: true }),
    ]).start();
  }, [pillScaleX, pillScaleY]);

  // ══════════════════════════════════════════
  // POPUP STATE (rendered in this component)
  // ══════════════════════════════════════════
  const [showPopup, setShowPopup] = useState(false);

  // Popup animations (RNAnimated)
  const popupOverlayAnim = useRef(new RNAnimated.Value(0)).current;
  const popupContentAnim = useRef(new RNAnimated.Value(0)).current;
  const popupCard0Anim = useRef(new RNAnimated.Value(0)).current;
  const popupCard1Anim = useRef(new RNAnimated.Value(0)).current;
  const popupCard2Anim = useRef(new RNAnimated.Value(0)).current;
  const popupCard3Anim = useRef(new RNAnimated.Value(0)).current;
  const popupCard4Anim = useRef(new RNAnimated.Value(0)).current;
  const popupCard5Anim = useRef(new RNAnimated.Value(0)).current;
  const popupCardPress0 = useRef(new RNAnimated.Value(1)).current;
  const popupCardPress1 = useRef(new RNAnimated.Value(1)).current;
  const popupCardPress2 = useRef(new RNAnimated.Value(1)).current;
  const popupCardPress3 = useRef(new RNAnimated.Value(1)).current;
  const popupCardPress4 = useRef(new RNAnimated.Value(1)).current;
  const popupCardPress5 = useRef(new RNAnimated.Value(1)).current;

  // ══════════════════════════════════════════
  // SOUNDS — FAB + Popup (expo-audio)
  // ══════════════════════════════════════════
  const fabIn = useAudioPlayer(require('../../assets/sounds/fab-press-in.mp4'));
  const fabOut = useAudioPlayer(require('../../assets/sounds/fab-press-out.mp4'));
  const popupOpen = useAudioPlayer(require('../../assets/sounds/popup-open.mp3'));
  const popupClose = useAudioPlayer(require('../../assets/sounds/popup-close.mp4'));
  const popupAmbient = useAudioPlayer(require('../../assets/sounds/popup-ambient.mp3'));
  const popupAmbientFadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fabIn.volume = 0.2;
    fabOut.volume = 0.2;
    popupOpen.volume = 0.11;
    popupClose.volume = 0.1;
    popupAmbient.volume = 0.05;
    popupAmbient.setPlaybackRate(0.9);
  }, [fabIn, fabOut, popupOpen, popupClose, popupAmbient]);

  const playIn = useCallback(() => {
    try {
      fabIn.seekTo(0);
      fabIn.play();
    } catch (_) {}
  }, [fabIn]);
  const playOut = useCallback(() => {
    try {
      fabOut.seekTo(0);
      fabOut.play();
    } catch (_) {}
  }, [fabOut]);
  const playPopupOpen = useCallback(() => {
    try {
      popupOpen.seekTo(0);
      popupOpen.play();
    } catch (_) {}
  }, [popupOpen]);
  const playPopupClose = useCallback(() => {
    try {
      popupClose.seekTo(0);
      popupClose.play();
    } catch (_) {}
  }, [popupClose]);
  const playPopupAmbient = useCallback(() => {
    if (popupAmbientFadeRef.current) {
      clearInterval(popupAmbientFadeRef.current);
      popupAmbientFadeRef.current = null;
    }
    try {
      popupAmbient.volume = 0.05;
      popupAmbient.seekTo(0);
      popupAmbient.play();
    } catch (_) {}
  }, [popupAmbient]);
  const stopPopupAmbient = useCallback(() => {
    if (popupAmbientFadeRef.current) {
      clearInterval(popupAmbientFadeRef.current);
      popupAmbientFadeRef.current = null;
    }
    const startVol = 0.05;
    const steps = 10;
    const stepVol = startVol / steps;
    let current = startVol;
    popupAmbientFadeRef.current = setInterval(() => {
      current -= stepVol;
      if (current <= 0) {
        if (popupAmbientFadeRef.current) {
          clearInterval(popupAmbientFadeRef.current);
          popupAmbientFadeRef.current = null;
        }
        try {
          popupAmbient.volume = 0;
          popupAmbient.pause();
        } catch (_) {}
        return;
      }
      try {
        popupAmbient.volume = current;
      } catch (_) {}
    }, 50);
  }, [popupAmbient]);

  // ══════════════════════════════════════════
  // FAB rotation
  // ══════════════════════════════════════════
  const rotateTo = useCallback((open: boolean) => {
    setFabOpen(open);
    RNAnimated.spring(fabRotAnim, {
      toValue: open ? 1 : 0,
      damping: 55,
      stiffness: 264,
      useNativeDriver: true,
    }).start();
  }, [fabRotAnim]);

  const fabRotateInterpolate = fabRotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });
  const fabStarRotateInterpolate = fabRotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-45deg'],
  });

  // ══════════════════════════════════════════
  // Open popup
  // ══════════════════════════════════════════
  const openPopup = useCallback(() => {
    popupOverlayAnim.setValue(0);
    popupContentAnim.setValue(0);
    [popupCard0Anim, popupCard1Anim, popupCard2Anim, popupCard3Anim, popupCard4Anim, popupCard5Anim].forEach((a) => a.setValue(0));
    [popupCardPress0, popupCardPress1, popupCardPress2, popupCardPress3, popupCardPress4, popupCardPress5].forEach((p) => p.setValue(1));

    setShowPopup(true);

    RNAnimated.timing(popupOverlayAnim, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();

    RNAnimated.spring(popupContentAnim, {
      toValue: 1,
      damping: 14,
      stiffness: 200,
      mass: 0.5,
      useNativeDriver: true,
    }).start();

    [popupCard0Anim, popupCard1Anim, popupCard2Anim, popupCard3Anim, popupCard4Anim, popupCard5Anim].forEach((anim, i) => {
      setTimeout(() => {
        RNAnimated.timing(anim, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
      }, i * POPUP_CARD_STAGGER_MS);
    });

    playPopupOpen();
    playPopupAmbient();

    // Bar recede — background recedes, icons stay in place
    RNAnimated.parallel([
      RNAnimated.spring(barScale, { toValue: 0.96, damping: 16, stiffness: 100, mass: 1.2, useNativeDriver: true }),
      RNAnimated.timing(barTranslateY, { toValue: 4, duration: 300, useNativeDriver: true }),
      RNAnimated.timing(barOpacity, { toValue: 0.88, duration: 300, useNativeDriver: true }),
      RNAnimated.timing(pillOpacity, { toValue: 0.5, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [popupOverlayAnim, popupContentAnim, popupCard0Anim, popupCard1Anim, popupCard2Anim, popupCard3Anim, popupCard4Anim, popupCard5Anim, popupCardPress0, popupCardPress1, popupCardPress2, popupCardPress3, popupCardPress4, popupCardPress5, playPopupOpen, playPopupAmbient, barScale, barTranslateY, barOpacity, pillOpacity]);

  // ══════════════════════════════════════════
  // Close popup
  // ══════════════════════════════════════════
  const closePopup = useCallback((playCloseSound = true) => {
    if (playCloseSound) playPopupClose();
    stopPopupAmbient();
    rotateTo(false);

    // Bar restore
    RNAnimated.parallel([
      RNAnimated.spring(barScale, { toValue: 1, damping: 16, stiffness: 100, mass: 1.2, useNativeDriver: true }),
      RNAnimated.timing(barTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      RNAnimated.timing(barOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      RNAnimated.timing(pillOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    RNAnimated.parallel([
      RNAnimated.timing(popupContentAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
      RNAnimated.timing(popupOverlayAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setShowPopup(false);
    });
  }, [popupOverlayAnim, popupContentAnim, playPopupClose, stopPopupAmbient, rotateTo, barScale, barTranslateY, barOpacity, pillOpacity]);

  // ══════════════════════════════════════════
  // FAB press handler
  // ══════════════════════════════════════════
  const handleFabPress = useCallback(() => {
    playOut(); // sound first so it starts as soon as haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    RNAnimated.timing(fabScaleAnim, {
      toValue: 1,
      duration: 55,
      useNativeDriver: true,
    }).start();

    if (fabOpen) {
      closePopup();
    } else {
      openedFromWorkoutRef.current = isWorkoutSelected;
      fabOpenedFromTabIndexRef.current = tabIndexFromPath;
      rotateTo(true);
      openPopup();
    }
  }, [fabOpen, fabScaleAnim, playOut, rotateTo, openPopup, closePopup, isWorkoutSelected, tabIndexFromPath]);

  const handleFabPressIn = useCallback(() => {
    playIn();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    RNAnimated.timing(fabScaleAnim, {
      toValue: 1.12,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [fabScaleAnim, playIn]);

  // ══════════════════════════════════════════
  // Popup card press animation
  // ══════════════════════════════════════════
  const popupCardPressRefs = [popupCardPress0, popupCardPress1, popupCardPress2, popupCardPress3, popupCardPress4, popupCardPress5];
  const cardPressIn = useCallback((card: 0 | 1 | 2 | 3 | 4 | 5) => {
    const sv = popupCardPressRefs[card];
    if (sv) RNAnimated.timing(sv, { toValue: 0.92, duration: 100, useNativeDriver: true }).start();
  }, [popupCardPress0, popupCardPress1, popupCardPress2, popupCardPress3, popupCardPress4, popupCardPress5]);

  const cardPressOut = useCallback((card: 0 | 1 | 2 | 3 | 4 | 5) => {
    const sv = popupCardPressRefs[card];
    if (sv) RNAnimated.timing(sv, { toValue: 1, duration: 100, useNativeDriver: true }).start();
  }, [popupCardPress0, popupCardPress1, popupCardPress2, popupCardPress3, popupCardPress4, popupCardPress5]);

  // ══════════════════════════════════════════
  // Popup card select handlers
  // ══════════════════════════════════════════
  const handleCardSelect = useCallback((card: 'saved' | 'search' | 'scan') => {
    stopPopupAmbient();
    rotateTo(false);

    // Bar restore on card select too
    RNAnimated.parallel([
      RNAnimated.spring(barScale, { toValue: 1, damping: 16, stiffness: 100, mass: 1.2, useNativeDriver: true }),
      RNAnimated.timing(barTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      RNAnimated.timing(barOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      RNAnimated.timing(pillOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    RNAnimated.parallel([
      RNAnimated.timing(popupContentAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
      RNAnimated.timing(popupOverlayAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setShowPopup(false);
      // Food cards: never redirect. If on nutrition tab, emit; otherwise open modal so user stays on current tab.
      if (isNutritionSelected) {
        emitCardSelect(card);
      } else {
        router.push({ pathname: '/food-action-modal', params: { card } });
      }
    });
  }, [popupOverlayAnim, popupContentAnim, stopPopupAmbient, rotateTo, barScale, barTranslateY, barOpacity, pillOpacity, router, isNutritionSelected]);

  const handleWorkoutCardSelect = useCallback((card: 'tmlsn' | 'your-routines' | 'empty') => {
    stopPopupAmbient();
    rotateTo(false);

    RNAnimated.parallel([
      RNAnimated.spring(barScale, { toValue: 1, damping: 16, stiffness: 100, mass: 1.2, useNativeDriver: true }),
      RNAnimated.timing(barTranslateY, { toValue: 0, duration: 200, useNativeDriver: true }),
      RNAnimated.timing(barOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      RNAnimated.timing(pillOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    RNAnimated.parallel([
      RNAnimated.timing(popupContentAnim, { toValue: 0, duration: 90, useNativeDriver: true }),
      RNAnimated.timing(popupOverlayAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setShowPopup(false);
      // Always open the workout PAGE (no modals). Keep toolbar highlight on the tab where FAB was opened.
      if (!openedFromWorkoutRef.current) setTabHighlightLock(fabOpenedFromTabIndexRef.current);
      if (card === 'tmlsn') router.push('/workout/tmlsn-routines');
      else if (card === 'your-routines') router.push('/workout/your-routines');
      else router.push({ pathname: '/workout', params: { startEmpty: '1' } });
    });
  }, [popupOverlayAnim, popupContentAnim, stopPopupAmbient, rotateTo, barScale, barTranslateY, barOpacity, pillOpacity, router]);

  // ══════════════════════════════════════════
  // Animated styles for popup
  // ══════════════════════════════════════════
  const overlayOpacity = popupOverlayAnim.interpolate({
    inputRange: [0, 0.18, 0.42, 0.65, 0.85, 1],
    outputRange: [0, 0.25, 0.72, 0.92, 0.98, 1],
    extrapolate: 'clamp',
  });

  const contentOpacity = popupOverlayAnim.interpolate({
    inputRange: [0, 0.18, 0.42, 0.65, 0.85, 1],
    outputRange: [0, 0.25, 0.72, 0.92, 0.98, 1],
    extrapolate: 'clamp',
  });
  const contentTranslateY = popupContentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [32, 0],
    extrapolate: 'clamp',
  });
  const contentScale = popupContentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
    extrapolate: 'clamp',
  });

  const makeCardStyle = (anim: RNAnimated.Value, pressAnim: RNAnimated.Value) => {
    const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0], extrapolate: 'clamp' });
    const scale = RNAnimated.multiply(
      anim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1], extrapolate: 'clamp' }),
      pressAnim,
    );
    const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.7, 1], extrapolate: 'clamp' });
    return { opacity, transform: [{ translateY }, { scale }] };
  };

  const card0Style = makeCardStyle(popupCard0Anim, popupCardPress0);
  const card1Style = makeCardStyle(popupCard1Anim, popupCardPress1);
  const card2Style = makeCardStyle(popupCard2Anim, popupCardPress2);
  const card3Style = makeCardStyle(popupCard3Anim, popupCardPress3);
  const card4Style = makeCardStyle(popupCard4Anim, popupCardPress4);
  const card5Style = makeCardStyle(popupCard5Anim, popupCardPress5);

  // ══════════════════════════════════════════════════════════════
  // CUSTOM TAB BAR — 3 layers: background, sliding pill, icons
  // ══════════════════════════════════════════════════════════════
  const renderTabBar = useCallback((props: any) => {
    const { state, navigation } = props;

    // Build ordered route list (skip "index" which is hidden)
    const visibleRoutes = state.routes.filter((r: any) => r.name !== 'index');

    return (
      <RNAnimated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: PILL_BOTTOM,
          height: PILL_HEIGHT,
          transform: [{ translateX: streakShiftX }],
        }}
      >
        {/* ── Layer 1: Animated background (recedes when FAB opens) ── */}
        <RNAnimated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: PILL_MARGIN_H,
            right: PILL_MARGIN_H,
            borderRadius: PILL_RADIUS,
            overflow: 'hidden',
            transform: [{ scale: barScale }, { translateY: barTranslateY }],
            opacity: barOpacity,
          }}
        >
          {/* Border gradient (matches top pills) */}
          <LinearGradient
            colors={['#4E4F50', '#4A4B4C']}
            style={[StyleSheet.absoluteFillObject, { borderRadius: PILL_RADIUS }]}
          />
          {/* Subtle gradient fill */}
          <LinearGradient
            colors={['#363738', '#2E2F30']}
            style={{
              position: 'absolute',
              top: 1,
              left: 1,
              right: 1,
              bottom: 1,
              borderRadius: PILL_RADIUS - 1,
            }}
          />

          {/* ── Layer 2: Sliding selected pill ── */}
          <RNAnimated.View
            style={{
              position: 'absolute',
              top: BORDER_INSET + SELECTED_TAB_PILL_V_PAD,
              left: 0,
              width: SELECTED_TAB_PILL_WIDTH,
              height: SELECTED_TAB_PILL_HEIGHT,
              borderRadius: SELECTED_TAB_PILL_RADIUS,
              backgroundColor: SELECTED_TAB_PILL_COLOR,
              transform: [
                { translateX: pillTranslateX },
                { scaleX: pillScaleX },
                { scaleY: pillScaleY },
              ],
              opacity: pillOpacity,
            }}
          />
        </RNAnimated.View>

        {/* ── Layer 3: Icon row (moves with bar when FAB opens) ── */}
        <RNAnimated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: PILL_MARGIN_H,
            right: PILL_MARGIN_H,
            flexDirection: 'row',
            alignItems: 'center',
            transform: [{ scale: barScale }, { translateY: barTranslateY }],
            opacity: barOpacity,
          }}
        >
          {visibleRoutes.map((route: any) => {
            const meta = TAB_META[route.name];

            // FAB center button
            if (route.name === 'fab-action') {
              return (
                <Pressable
                  key={route.key}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  onPressIn={handleFabPressIn}
                  onPress={handleFabPress}
                >
                  <RNAnimated.View
                    style={{
                      width: 44.8,
                      height: 44.8,
                      justifyContent: 'center',
                      alignItems: 'center',
                      transform: [{ scale: fabScaleAnim }],
                    }}
                  >
                    <RNAnimated.Image
                      source={require('../../assets/fab-star.png')}
                      style={{
                        width: 46.4,
                        height: 46.4,
                        position: 'absolute',
                        transform: [{ rotate: fabStarRotateInterpolate }],
                      }}
                      resizeMode="contain"
                    />
                    <RNAnimated.View
                      style={{
                        width: 19.2,
                        height: 19.2,
                        justifyContent: 'center',
                        alignItems: 'center',
                        transform: [{ rotate: fabRotateInterpolate }],
                      }}
                    >
                      <View style={{ position: 'absolute', width: 19.2, height: 2.88, borderRadius: 1.44, backgroundColor: '#2F3031' }} />
                      <View style={{ position: 'absolute', width: 2.88, height: 19.2, borderRadius: 1.44, backgroundColor: '#2F3031' }} />
                    </RNAnimated.View>
                  </RNAnimated.View>
                </Pressable>
              );
            }

            // Regular tab — use activeTabIndex so highlight can stay on FAB-origin tab when workout page is open
            if (!meta) return null;
            const tabIdx = meta.tabIndex;
            const isFocused = state.index === state.routes.indexOf(route);

            return (
              <TabButton
                key={route.key}
                label={meta.label}
                icon={meta.icon}
                selected={activeTabIndex === tabIdx}
                scaleAnim={tabScales[tabIdx]}
                onTabPressIn={() => handleTabPressIn(tabIdx)}
                onTabPressOut={() => handleTabPressOut(tabIdx)}
                onTabLongPress={handleTabLongPress}
                onPress={() => {
                  clearTabHighlightLock();
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
              />
            );
          })}
        </RNAnimated.View>
      </RNAnimated.View>
    );
  }, [
    streakShiftX,
    barScale, barTranslateY, barOpacity,
    pillTranslateX, pillScaleX, pillScaleY, pillOpacity,
    tabScales, handleTabPressIn, handleTabPressOut, handleTabLongPress,
    fabScaleAnim, fabStarRotateInterpolate, fabRotateInterpolate,
    handleFabPressIn, handleFabPress,
    activeTabIndex, clearTabHighlightLock,
  ]);

  return (
    <StreakShiftContext.Provider value={streakShiftX}>
    <View style={{ flex: 1 }}>
      <Tabs
        initialRouteName="nutrition"
        detachInactiveScreens={false}
        tabBar={renderTabBar}
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.primaryDark,
          },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontSize: Typography.h1,
            fontWeight: Typography.weights.bold,
          },
        }}
      >
        {/* Hidden index redirect */}
        <Tabs.Screen
          name="index"
          options={{ href: null, title: 'Home', headerTitle: 'TMLSN' }}
        />

        {/* ── Tab 1: Home (nutrition) ── */}
        <Tabs.Screen
          name="nutrition"
          options={{ title: 'Home', headerShown: false }}
        />

        {/* ── Tab 2: Workout ── */}
        <Tabs.Screen
          name="workout"
          options={{ title: 'WORKOUT', headerShown: false }}
        />

        {/* ── Tab 3 (center): FAB action – not a real page ── */}
        <Tabs.Screen
          name="fab-action"
          options={{ title: '' }}
        />

        {/* ── Tab 4: Prompts ── */}
        <Tabs.Screen
          name="prompts"
          options={{ title: 'PROMPTS', headerTitle: 'PROMPTS' }}
        />

        {/* ── Tab 5: Profile ── */}
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile', headerTitle: 'Profile', headerShown: true }}
        />
      </Tabs>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* POPUP OVERLAY — rendered ABOVE Tabs so it's always on top */}
      {/* ══════════════════════════════════════════════════════════ */}
      {showPopup && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Dark overlay + dismiss */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closePopup(true)}>
            <RNAnimated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.55)', opacity: overlayOpacity }]} />
          </Pressable>

          {/* Cards container */}
          <RNAnimated.View
            pointerEvents="box-none"
            style={{
              ...StyleSheet.absoluteFillObject,
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingBottom: PILL_BOTTOM + PILL_HEIGHT + 24,
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }, { scale: contentScale }],
            }}
          >
            {/* Universal popup: left column = nutrition, right column = workout */}
            <View style={{ flexDirection: 'row', gap: POPUP_CARD_GAP }}>
              {/* Left column: saved foods, search food, scan food */}
              <View style={{ gap: POPUP_CARD_GAP }}>
                <RNAnimated.View style={card0Style}>
                  <TouchableOpacity
                    style={popupStyles.card}
                    onPress={() => handleCardSelect('saved')}
                    onPressIn={() => cardPressIn(0)}
                    onPressOut={() => cardPressOut(0)}
                    activeOpacity={1}
                  >
                    <Image source={require('../../assets/saved-food-icon.png')} style={popupStyles.scanFoodIcon} resizeMode="contain" />
                    <Text style={popupStyles.cardLabel}>saved foods</Text>
                  </TouchableOpacity>
                </RNAnimated.View>
                <RNAnimated.View style={card1Style}>
                  <TouchableOpacity
                    style={popupStyles.card}
                    onPress={() => handleCardSelect('search')}
                    onPressIn={() => cardPressIn(1)}
                    onPressOut={() => cardPressOut(1)}
                    activeOpacity={1}
                  >
                    <Image source={require('../../assets/search-food-icon.png')} style={popupStyles.searchFoodIcon} resizeMode="contain" />
                    <Text style={popupStyles.cardLabel}>search food</Text>
                  </TouchableOpacity>
                </RNAnimated.View>
                <RNAnimated.View style={card2Style}>
                  <TouchableOpacity
                    style={popupStyles.card}
                    onPress={() => handleCardSelect('scan')}
                    onPressIn={() => cardPressIn(2)}
                    onPressOut={() => cardPressOut(2)}
                    activeOpacity={1}
                  >
                    <Image source={require('../../assets/scan-food-ai-icon.png')} style={popupStyles.scanFoodIcon} resizeMode="contain" />
                    <Text style={popupStyles.cardLabel}>scan food</Text>
                  </TouchableOpacity>
                </RNAnimated.View>
              </View>
              {/* Right column: tmlsn routines, your routines, start empty workout */}
              <View style={{ gap: POPUP_CARD_GAP }}>
                <RNAnimated.View style={card3Style}>
                  <TouchableOpacity
                    style={popupStyles.card}
                    onPress={() => handleWorkoutCardSelect('tmlsn')}
                    onPressIn={() => cardPressIn(3)}
                    onPressOut={() => cardPressOut(3)}
                    activeOpacity={1}
                  >
                    <Image source={require('../../assets/saved-food-icon.png')} style={popupStyles.scanFoodIcon} resizeMode="contain" />
                    <Text style={popupStyles.cardLabel}>tmlsn routines</Text>
                  </TouchableOpacity>
                </RNAnimated.View>
                <RNAnimated.View style={card4Style}>
                  <TouchableOpacity
                    style={popupStyles.card}
                    onPress={() => handleWorkoutCardSelect('your-routines')}
                    onPressIn={() => cardPressIn(4)}
                    onPressOut={() => cardPressOut(4)}
                    activeOpacity={1}
                  >
                    <Image source={require('../../assets/search-food-icon.png')} style={popupStyles.searchFoodIcon} resizeMode="contain" />
                    <Text style={popupStyles.cardLabel}>your routines</Text>
                  </TouchableOpacity>
                </RNAnimated.View>
                <RNAnimated.View style={card5Style}>
                  <TouchableOpacity
                    style={popupStyles.card}
                    onPress={() => handleWorkoutCardSelect('empty')}
                    onPressIn={() => cardPressIn(5)}
                    onPressOut={() => cardPressOut(5)}
                    activeOpacity={1}
                  >
                    <Image source={require('../../assets/scan-food-ai-icon.png')} style={popupStyles.scanFoodIcon} resizeMode="contain" />
                    <Text style={popupStyles.cardLabel}>start empty workout</Text>
                  </TouchableOpacity>
                </RNAnimated.View>
              </View>
            </View>
          </RNAnimated.View>
        </View>
      )}
    </View>
    </StreakShiftContext.Provider>
  );
}

const popupStyles = StyleSheet.create({
  card: {
    width: POPUP_CARD_WIDTH,
    height: POPUP_CARD_HEIGHT,
    borderRadius: POPUP_CARD_RADIUS,
    backgroundColor: '#C6C6C6',
    paddingBottom: 12,
    justifyContent: 'flex-end',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  scanFoodIcon: {
    position: 'absolute',
    top: -2,
    left: '50%',
    marginLeft: -61,
    width: 122,
    height: 67,
  },
  searchFoodIcon: {
    position: 'absolute',
    top: 3,
    left: '50%',
    marginLeft: -55,
    width: 110,
    height: 60,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2F3031',
    letterSpacing: -0.11,
    textAlign: 'center',
  },
});
