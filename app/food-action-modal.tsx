import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import NutritionScreen from './(tabs)/nutrition';

type FoodCard = 'saved' | 'search' | 'scan';

/**
 * Root-level modal for food actions (saved / search / scan) opened from FAB when not on nutrition tab.
 * Keeps the user on their current tab; when they close, they stay where they were.
 */
export default function FoodActionModal() {
  const router = useRouter();
  const { card } = useLocalSearchParams<{ card?: string }>();
  const initialOpenCard = (card === 'saved' || card === 'search' || card === 'scan' ? card : 'saved') as FoodCard;

  return (
    <NutritionScreen
      asModal
      initialOpenCard={initialOpenCard}
      onCloseModal={() => router.back()}
    />
  );
}
