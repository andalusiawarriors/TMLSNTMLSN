import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
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
import { Colors } from '../constants/theme';

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
    // Register for push notifications on app start
    registerForPushNotifications();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.primaryDark,
          },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: Colors.black,
          },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="tmlsn-routines-modal"
          options={{
            presentation: 'modal',
            gestureEnabled: true,
            gestureDirection: 'vertical',
            headerShown: false,
            title: 'TMLSN routines',
            contentStyle: { backgroundColor: Colors.primaryDark },
          }}
        />
        <Stack.Screen
          name="your-routines-modal"
          options={{
            presentation: 'modal',
            headerShown: false,
            title: 'Your routines',
          }}
        />
        <Stack.Screen
          name="start-empty-workout-modal"
          options={{
            presentation: 'modal',
            headerShown: false,
            title: 'Workout',
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
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
