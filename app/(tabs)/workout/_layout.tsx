import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, Text } from 'react-native';
import { Colors } from '../../../constants/theme';

export default function WorkoutLayout() {
  const router = useRouter();

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primaryDark },
        headerTintColor: Colors.primaryLight,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: Colors.primaryDark },
        animation: 'slide_from_right',
        animationDuration: 220,
        headerLeft: () => (
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              { marginLeft: 8, paddingVertical: 8, paddingRight: 16 },
              pressed && { opacity: 0.7 },
            ]}
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
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="your-routines"
        options={{
          title: 'your routines',
          headerShown: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'settings',
          headerShown: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="streak"
        options={{
          title: 'streak',
          headerShown: true,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="statistics"
        options={{
          title: 'statistics',
          headerShown: true,
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
