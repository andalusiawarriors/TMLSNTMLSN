/**
 * useExerciseReorder
 * ------------------
 * Hook that provides long-press drag-to-reorder state for the exercise list.
 * Designed to be used directly inside the workout overlay component.
 *
 * Pattern:
 *   const reorder = useExerciseReorder(activeWorkout.exercises, updateExercises);
 *
 *   // In exercise header:
 *   <Pressable
 *     onLongPress={() => reorder.onLongPress(exerciseIndex)}
 *     onPressIn={() => reorder.onPressIn(exerciseIndex)}
 *     style={reorder.getDragHandleStyle(exerciseIndex)}
 *   >
 *     <Text style={{ opacity: 0.5 }}>≡</Text>
 *   </Pressable>
 *
 *   // In exercise card wrapper:
 *   style={reorder.getCardStyle(exerciseIndex)}
 */

import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ViewStyle } from 'react-native';

type Exercise = { id: string };

export type ExerciseReorderHandle = {
  /** Index currently being "held" for reorder (null = idle) */
  activeIndex: number | null;
  /** Call this from the exercise drag handle's onLongPress */
  onLongPress: (index: number) => void;
  /** Move the active exercise one step up */
  moveUp: () => void;
  /** Move the active exercise one step down */
  moveDown: () => void;
  /** Deactivate reorder mode */
  cancel: () => void;
  /** Returns animated card wrapper style (dimmed when another card is active) */
  getCardStyle: (index: number) => ViewStyle;
  /** Returns style for drag handle icon (highlighted when this card is active) */
  getDragHandleStyle: (index: number) => ViewStyle;
};

export function useExerciseReorder<T extends Exercise>(
  exercises: T[],
  onReorder: (newExercises: T[]) => void,
): ExerciseReorderHandle {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onLongPress = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveIndex(index);
  }, []);

  const moveUp = useCallback(() => {
    if (activeIndex === null || activeIndex === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...exercises];
    const temp = next[activeIndex - 1];
    next[activeIndex - 1] = next[activeIndex];
    next[activeIndex] = temp;
    onReorder(next);
    setActiveIndex(activeIndex - 1);
  }, [activeIndex, exercises, onReorder]);

  const moveDown = useCallback(() => {
    if (activeIndex === null || activeIndex >= exercises.length - 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...exercises];
    const temp = next[activeIndex + 1];
    next[activeIndex + 1] = next[activeIndex];
    next[activeIndex] = temp;
    onReorder(next);
    setActiveIndex(activeIndex + 1);
  }, [activeIndex, exercises, onReorder]);

  const cancel = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const getCardStyle = useCallback((index: number): ViewStyle => {
    if (activeIndex === null) return {};
    if (index === activeIndex) return { opacity: 1, transform: [{ scale: 1.01 }] };
    return { opacity: 0.45 };
  }, [activeIndex]);

  const getDragHandleStyle = useCallback((index: number): ViewStyle => {
    if (activeIndex === index) return { opacity: 1 };
    return { opacity: 0.4 };
  }, [activeIndex]);

  return {
    activeIndex,
    onLongPress,
    moveUp,
    moveDown,
    cancel,
    getCardStyle,
    getDragHandleStyle,
  };
}
