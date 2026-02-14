import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Colors } from '../../../constants/theme';

export default function WorkoutLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primaryDark },
        headerTintColor: Colors.primaryLight,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: Colors.primaryDark },
        headerLeft: () => (
          <Pressable
            onPress={() => router.replace('/workout')}
            style={{ marginLeft: 8, paddingVertical: 8, paddingRight: 16 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={{ color: Colors.primaryLight, fontSize: 17 }}>‹ Back</Text>
          </Pressable>
        ),
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
      <Stack.Screen
        name="statistics"
        options={{
          title: 'statistics',
          headerShown: true,
          animation: 'fade_from_bottom',
        }}
      />
    </Stack>
  );
}
