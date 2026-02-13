import { Stack } from 'expo-router';
import { Colors } from '../../../constants/theme';

export default function WorkoutLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primaryDark },
        headerTintColor: Colors.primaryLight,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: Colors.primaryDark },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="tmlsn-routines"
        options={{
          title: 'tmlsn routines',
          headerShown: true,
          animation: 'fade_from_bottom',
        }}
      />
      <Stack.Screen
        name="your-routines"
        options={{
          title: 'your routines',
          headerShown: true,
          animation: 'fade_from_bottom',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'settings',
          headerShown: true,
          animation: 'fade_from_bottom',
        }}
      />
      <Stack.Screen
        name="streak"
        options={{
          title: 'streak',
          headerShown: true,
          animation: 'fade_from_bottom',
        }}
      />
    </Stack>
  );
}
