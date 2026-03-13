import 'react-native-url-polyfill/auto';

import { Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import type { ReactNode } from 'react';

/** Wraps children with HapticProvider only when not in Expo Go (NitroModules crash there). Restores same provider tree as when quantity-card haptics worked. */
function HapticProviderWrapper({ children }: { children: ReactNode }) {
  const isExpoGo = Constants.appOwnership === 'expo';
  if (isExpoGo) return <>{children}</>;
  const { HapticProvider } = require('@renegades/react-native-tickle');
  return <HapticProvider>{children}</HapticProvider>;
}

// Keep native splash visible until fonts load (avoids blank screen)
SplashScreen.preventAutoHideAsync();
import {
  useFonts,
  EBGaramond_400Regular,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
  EBGaramond_700Bold,
  EBGaramond_800ExtraBold,
} from '@expo-google-fonts/eb-garamond';
import { DMMono_300Light, DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Inconsolata_400Regular } from '@expo-google-fonts/inconsolata';
import { RobotoMono_400Regular } from '@expo-google-fonts/roboto-mono';
import { registerForPushNotifications } from '../utils/notifications';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { ActiveWorkoutProvider } from '../context/ActiveWorkoutContext';
import { AuthProvider } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActiveWorkoutPill } from '../components/ActiveWorkoutPill';
import { useActiveWorkout } from '../context/ActiveWorkoutContext';
import { onHomeTabState, emitHomeTab, emitCloseAiChatOverlay } from '../utils/fabBridge';
import { LiquidGlassSegmented } from '../components/ui/liquidGlass';

function RootLayoutInner() {
  const { colors } = useTheme();
  const { activeWorkout } = useActiveWorkout();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [overlayHomeTab, setOverlayHomeTab] = useState<'calories' | 'progress' | 'fitness'>('calories');
  const isNutritionSelected = pathname.includes('nutrition');

  useEffect(() => {
    return onHomeTabState((tab) => setOverlayHomeTab(tab));
  }, []);

  return (
    <View style={styles.rootInner}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primaryDark },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.black },
          gestureEnabled: !activeWorkout,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="saved-foods"
          options={{
            title: 'Saved Foods',
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.primaryDark },
          }}
        />
        <Stack.Screen
          name="search-food"
          options={{
            title: 'Search food',
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.primaryDark },
          }}
        />
        <Stack.Screen
          name="fitness-hub-tmlsn-routines"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="fitness-hub-your-routines"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="fitness-hub-start-empty"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="food-action-modal"
          options={{
            presentation: 'transparentModal',
            headerShown: false,
            title: 'Food',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="preferences"
          options={{
            title: 'settings',
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.primaryDark },
            headerStyle: { backgroundColor: colors.primaryDark },
            headerTintColor: colors.primaryLight,
          }}
        />
        <Stack.Screen
          name="progress-graph"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="strength-muscles"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="progress-heatmap"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="workout-history"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="workout-detail"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="workout-edit"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="exercises"
          options={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#1A1A1A' } }}
        />
        <Stack.Screen
          name="week-builder"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: '#1A1A1A' },
          }}
        />
        <Stack.Screen
          name="tmlsnai"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.primaryDark },
          }}
        />
        <Stack.Screen
          name="ai-food-chat"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.primaryDark },
          }}
        />
      </Stack>
      {/* Nutrition/Progress/Fitness toggle — at root so top: 54 is 54pt from screen top */}
      {isNutritionSelected && (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { zIndex: 99999, elevation: 99999 }]}
        >
          <View
            style={{
              position: 'absolute',
              top: insets.top - 8 + 10,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <View style={[styles.toggleBacking, { backgroundColor: '#1a1a1a' }]}>
              <LiquidGlassSegmented
                options={[
                  { key: 'calories', label: 'nutrition.' },
                  { key: 'progress', label: 'progress.' },
                  { key: 'fitness', label: 'fitness.' },
                ]}
                value={overlayHomeTab}
                onChange={(k) => {
                  const tab = k as 'calories' | 'progress' | 'fitness';
                  setOverlayHomeTab(tab);
                  emitHomeTab(tab);
                  if (tab !== overlayHomeTab) emitCloseAiChatOverlay();
                }}
                style={{ alignSelf: 'center' }}
                trackVariant="addFood"
              />
            </View>
          </View>
        </View>
      )}
      {/* Active workout pill at root — visible above modals and overlay */}
      <ActiveWorkoutPill />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    EBGaramond_400Regular,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    EBGaramond_700Bold,
    EBGaramond_800ExtraBold,
    DMMono_300Light,
    DMMono_400Regular,
    DMMono_500Medium,
    SpaceMono_400Regular,
    Inconsolata_400Regular,
    RobotoMono_400Regular,
  });

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    if (__DEV__) {
      try {
        const { closeMenu, hideMenu } = require('expo-dev-menu');
        closeMenu();
        hideMenu();
      } catch (_) {}
    }
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <BottomSheetModalProvider>
      <HapticProviderWrapper>
        <ThemeProvider>
          <AuthProvider>
            <ActiveWorkoutProvider>
              <RootLayoutInner />
            </ActiveWorkoutProvider>
          </AuthProvider>
        </ThemeProvider>
      </HapticProviderWrapper>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootInner: { flex: 1 },
  toggleBacking: { width: 234, height: 36, borderRadius: 18, justifyContent: 'center' as const, alignItems: 'center' as const },
});
