import { Tabs } from 'expo-router';
import { Colors, Typography } from '../../constants/theme';
import { Platform } from 'react-native';
import { Text } from 'react-native';

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
          fontSize: 11,
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
          href: null,
          title: 'Home',
          headerTitle: 'TMLSN',
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Calorie',
          tabBarLabel: 'Calorie',
          headerTitle: 'Calorie',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, color }}>🍎</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout Tracker',
          tabBarLabel: 'Workout Tracker',
          headerTitle: 'Workout Tracker',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, color }}>💪</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="prompts"
        options={{
          title: 'Newsletter prompts',
          tabBarLabel: 'Newsletter prompts',
          headerTitle: 'Newsletter prompts',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24, color }}>📝</Text>
          ),
        }}
      />
    </Tabs>
  );
}
