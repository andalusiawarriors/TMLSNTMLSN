import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/nutrition');
  }, []);
  // Render an empty view matching app background so nothing flashes
  return <View style={{ flex: 1, backgroundColor: '#2F3031' }} />;
}
