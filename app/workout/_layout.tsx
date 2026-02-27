import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, Text } from 'react-native';
import { Colors } from '../../constants/theme';

export default function WorkoutLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={({ route }) => {
        const params = route.params as { returnTo?: string } | undefined;
        return {
        headerStyle: { backgroundColor: Colors.primaryDark },
        headerTintColor: Colors.primaryLight,
        headerBackVisible: false,
        contentStyle: { backgroundColor: Colors.primaryDark },
        animation: 'slide_from_right',
        animationDuration: 220,
        headerLeft: () => (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (params?.returnTo === 'profile') {
                router.replace('/(tabs)/profile');
              } else {
                router.back();
              }
            }}
            style={({ pressed }) => [
              {
                marginLeft: 8,
                height: 36,
                paddingHorizontal: 12,
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
              },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={{ color: Colors.primaryLight, fontSize: 15 }}>‹ Back</Text>
          </Pressable>
        ),
      };
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="tmlsn-routines"
        options={{
          title: 'TMLSN Routines',
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="your-routines"
        options={{
          title: 'Your Routines',
          headerShown: false,
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
