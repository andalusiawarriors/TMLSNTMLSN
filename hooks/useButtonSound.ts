import { useCallback, useEffect } from 'react';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * Same button press sound as calorie tracker: card-press-in + card-press-out.
 * playIn on press down, playOut on release (supports long press).
 */
export function useButtonSound() {
  const cardPressIn = useAudioPlayer(require('../assets/sounds/card-press-in.mp4'));
  const cardPressOut = useAudioPlayer(require('../assets/sounds/card-press-out.mp4'));

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: false,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {});
  }, []);

  useEffect(() => {
    cardPressIn.volume = 0.2;
    cardPressOut.volume = 0.2;
  }, [cardPressIn, cardPressOut]);

  const playIn = useCallback(() => {
    try {
      cardPressIn.seekTo(0);
      cardPressIn.play();
    } catch (_) {}
  }, [cardPressIn]);

  const playOut = useCallback(() => {
    try {
      cardPressOut.seekTo(0);
      cardPressOut.play();
    } catch (_) {}
  }, [cardPressOut]);

  return { playIn, playOut };
}
