import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';

export default function Index() {
  const router = useRouter();
  const { colors } = useTheme();
  // Redirect to home whenever this screen is focused (e.g. Back from streak lands here)
  useFocusEffect(
    useCallback(() => {
      router.replace('/nutrition');
    }, [router])
  );
  // Render an empty view matching app background so nothing flashes
  return <View style={{ flex: 1, backgroundColor: colors.primaryDark }} />;
}
