import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function ExercisesLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.primaryDark } }}>
      <Stack.Screen name="index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="[id]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
