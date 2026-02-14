import { useCallback, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';

/**
 * Same button press sound as calorie tracker: card-press-in + card-press-out.
 * playIn on press down, playOut on release (supports long press).
 */
export function useButtonSound() {
  const cardPressInRef = useRef<Audio.Sound | null>(null);
  const cardPressOutRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let cardPressIn: Audio.Sound | null = null;
    let cardPressOut: Audio.Sound | null = null;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: false,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound: sIn } = await Audio.Sound.createAsync(
          require('../assets/sounds/card-press-in.mp4')
        );
        await sIn.setVolumeAsync(0.2);
        cardPressIn = sIn;
        cardPressInRef.current = sIn;

        const { sound: sOut } = await Audio.Sound.createAsync(
          require('../assets/sounds/card-press-out.mp4')
        );
        await sOut.setVolumeAsync(0.2);
        cardPressOut = sOut;
        cardPressOutRef.current = sOut;
      } catch (_) {
        // Assets missing or load failed – sounds will be silent
      }
    })();

    return () => {
      if (cardPressIn) cardPressIn.unloadAsync();
      if (cardPressOut) cardPressOut.unloadAsync();
      cardPressInRef.current = null;
      cardPressOutRef.current = null;
    };
  }, []);

  const playIn = useCallback(() => {
    const s = cardPressInRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);

  const playOut = useCallback(() => {
    const s = cardPressOutRef.current;
    if (s) {
      s.setPositionAsync(0);
      s.playAsync().catch(() => {});
    }
  }, []);

  return { playIn, playOut };
}
