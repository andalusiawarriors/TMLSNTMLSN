import { Tabs } from 'expo-router';
import { Colors, Typography } from '../../constants/theme';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.accentBlue,
        tabBarInactiveTintColor: Colors.primaryLight,
        tabBarStyle: {
          backgroundColor: Colors.primaryDark,
          borderTopColor: Colors.primaryLight,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: Typography.weights.medium,
        },
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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          headerTitle: 'TMLSN',
          tabBarIcon: ({ color }) => (
            <HomeIcon color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarLabel: 'Nutrition',
          headerTitle: 'Nutrition Tracker',
          tabBarIcon: ({ color }) => (
            <NutritionIcon color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarLabel: 'Workout',
          headerTitle: 'Workout Tracker',
          tabBarIcon: ({ color }) => (
            <WorkoutIcon color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="prompts"
        options={{
          title: 'Prompts',
          tabBarLabel: 'Prompts',
          headerTitle: 'Prompt Vault',
          tabBarIcon: ({ color }) => (
            <PromptsIcon color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

// Simple icon components (using Unicode symbols for MVP)
import { Text } from 'react-native';

const HomeIcon = ({ color }: { color: string }) => (
  <Text style={{ fontSize: 24, color }}>🏠</Text>
);

const NutritionIcon = ({ color }: { color: string }) => (
  <Text style={{ fontSize: 24, color }}>🍎</Text>
);

const WorkoutIcon = ({ color }: { color: string }) => (
  <Text style={{ fontSize: 24, color }}>💪</Text>
);

const PromptsIcon = ({ color }: { color: string }) => (
  <Text style={{ fontSize: 24, color }}>📝</Text>
);
