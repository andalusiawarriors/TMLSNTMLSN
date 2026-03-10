import React from 'react';
import { useRouter } from 'expo-router';

export default function FitnessHubStartEmptyPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace({ pathname: '/(tabs)/workout', params: { startEmpty: '1' } } as any);
  }, []);

  return null;
}
