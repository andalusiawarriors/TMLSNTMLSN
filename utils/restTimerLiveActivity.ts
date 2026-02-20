/**
 * Rest Timer Live Activity – Dynamic Island & Lock Screen
 *
 * Shows countdown timer on the right and exercise info/icon on the left when
 * the app is backgrounded during a rest period.
 *
 * Requires native setup – see docs/LIVE_ACTIVITY_SETUP.md
 */

import { Platform } from 'react-native';

let createLiveActivityFn: (opts: {
  title: string;
  timerTitle: string;
  buttonTitle: string;
  endDateTime: Date | string;
  timerColor?: string;
  imageName?: string;
}) => Promise<string | undefined>;
let endLiveActivityFn: (activityId: string) => Promise<void>;

if (Platform.OS === 'ios') {
  try {
    const LA = require('@txo/live-activity-countdown-react-native');
    createLiveActivityFn = LA.createLiveActivity;
    endLiveActivityFn = LA.endLiveActivity;
  } catch {
    createLiveActivityFn = async () => undefined;
    endLiveActivityFn = async () => {};
  }
} else {
  createLiveActivityFn = async () => undefined;
  endLiveActivityFn = async () => {};
}

let currentActivityId: string | null = null;

export async function startRestTimerLiveActivity(
  exerciseName: string,
  secondsRemaining: number
): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await endRestTimerLiveActivity();

  const endDate = new Date(Date.now() + secondsRemaining * 1000);

  try {
    const id = await createLiveActivityFn({
      title: exerciseName,
      timerTitle: 'Rest',
      buttonTitle: 'Open TMLSN',
      endDateTime: endDate,
      timerColor: '#C6C6C6',
      imageName: 'AppLogoLiveActivity',
    });
    currentActivityId = id || null;
  } catch (e) {
    console.warn('[RestTimerLiveActivity] Start failed:', e);
    currentActivityId = null;
  }
}

export async function endRestTimerLiveActivity(): Promise<void> {
  if (Platform.OS !== 'ios' || !currentActivityId) return;

  try {
    await endLiveActivityFn(currentActivityId);
  } catch (e) {
    console.warn('[RestTimerLiveActivity] End failed:', e);
  } finally {
    currentActivityId = null;
  }
}
