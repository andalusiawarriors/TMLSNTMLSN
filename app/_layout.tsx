// URL polyfill loaded in index.js (native only); no-op on web
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';

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
import { ActiveWorkoutPill } from '../components/ActiveWorkoutPill';

function RootLayoutInner() {
  const { colors } = useTheme();

  return (
    <View style={styles.rootInner}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primaryDark },
          headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.primaryDark },
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
          name="tmlsn-routines-modal"
          options={{
            presentation: 'modal',
            gestureEnabled: true,
            gestureDirection: 'vertical',
            headerShown: false,
            title: 'TMLSN routines',
            contentStyle: { backgroundColor: colors.primaryDark },
          }}
        />
        <Stack.Screen
          name="your-routines-modal"
          options={{
            presentation: 'modal',
            headerShown: false,
            title: 'Your routines',
            contentStyle: { backgroundColor: colors.primaryDark },
          }}
        />
        <Stack.Screen
          name="start-empty-workout-modal"
          options={{
            presentation: 'modal',
            headerShown: false,
            title: 'Workout',
            contentStyle: { backgroundColor: colors.primaryDark },
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
          name="workout-save"
          options={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.primaryDark } }}
        />
        <Stack.Screen
          name="workout-history"
          options={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.primaryDark } }}
        />
        <Stack.Screen
          name="workout-detail"
          options={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.primaryDark } }}
        />
        <Stack.Screen
          name="progress-graph"
          options={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.primaryDark } }}
        />
        <Stack.Screen
          name="progress-heatmap"
          options={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.primaryDark } }}
        />
      </Stack>
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

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AuthProvider>
          <ActiveWorkoutProvider>
            <RootLayoutInner />
          </ActiveWorkoutProvider>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootInner: { flex: 1 },
});
