/**
 * liveActivity.ts
 *
 * Single persistent Live Activity that animates between three states:
 *
 *   Workout  →  "Push A · Workout in progress"           (default)
 *   Rest     →  "Bench Press · Rest · Set 1 complete"    (countdown ring)
 *   RPE      →  "Push Harder 💪 · Bench Press · RPE 5"  (countdown ring)
 *
 * On DI iPhones (14 Pro+) these appear in the Dynamic Island hardware and
 * on the Lock Screen. On older phones / Android the calls are no-ops.
 *
 * Usage:
 *   await startWorkoutActivity('Push A');
 *   await updateToRestTimer('Bench Press', 1, 90);   // auto-reverts after 90 s
 *   await updateToRPEWarning(5, 'Bench Press');       // auto-reverts after 8 s
 *   await stopWorkoutActivity();
 *
 * Post-session (no workout activity running):
 *   await startRPEActivity(5, 'Bench Press', 'post');
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const ACTIVITY_ID_KEY = 'workout_live_activity_id';

// ─── Types ────────────────────────────────────────────────────────────────────

type LiveActivityState = {
  title: string;
  subtitle?: string;
  progressBar?: { date?: number; progress?: number };
};

type LiveActivityConfig = {
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  progressViewTint?: string;
  timerType?: 'circular' | 'digital';
};

type LiveActivityModule = {
  startActivity: (state: LiveActivityState, config?: LiveActivityConfig) => string | undefined;
  stopActivity:  (id: string, state: LiveActivityState) => void;
  updateActivity:(id: string, state: LiveActivityState) => void;
};

// ─── Module loader ────────────────────────────────────────────────────────────

function getModule(): LiveActivityModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-live-activity') as LiveActivityModule;
    if (!mod || typeof mod.startActivity !== 'function') return null;
    return mod;
  } catch {
    return null;
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

let workoutActivityId:  string | null = null;
let currentWorkoutName: string        = '';
let revertTimer: ReturnType<typeof setTimeout> | null = null;

// Restore activity ID from AsyncStorage on module load so mid-workout
// calls (updateToRestTimer, updateToRPEWarning) survive JS hot reloads.
(async () => {
  try {
    const storedId = await AsyncStorage.getItem(ACTIVITY_ID_KEY);
    if (storedId && !workoutActivityId) {
      workoutActivityId = storedId;
      console.log('[LiveActivity] restored ID from storage:', storedId);
    }
  } catch {}
})();

// When a rest timer is active, remember its state so the RPE warning can revert to it
let pendingRestTimer: { exerciseName: string; setNumber: number; endTimeMs: number } | null = null;

// Post-session only (fired after workout ends)
let postRPEActivityId:     string | null = null;
let autoDismissPostRPETimer: ReturnType<typeof setTimeout> | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearRevertTimer(): void {
  if (revertTimer !== null) { clearTimeout(revertTimer); revertTimer = null; }
}

/** Revert the single activity back to the base workout state. */
function revertToWorkoutState(): void {
  clearRevertTimer();
  const mod = getModule();
  if (!mod || !workoutActivityId) return;
  try {
    mod.updateActivity(workoutActivityId, {
      title:    currentWorkoutName,
      subtitle: 'Workout in progress',
    });
  } catch (e) {
    console.warn('[LiveActivity] revertToWorkoutState failed:', e);
  }
}

// ─── Local notification ───────────────────────────────────────────────────────

export async function sendRPENotification(
  rpe: number,
  exerciseName: string,
  context: 'active' | 'post',
): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const title = context === 'active' ? 'Push Harder 💪' : 'Aim Higher Next Session';
    const body  = context === 'active'
      ? `${exerciseName} · RPE ${rpe} — drive to 7+ next set`
      : `Avg RPE ${rpe} on ${exerciseName} — leave less in the tank`;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (e) {
    console.warn('[LiveActivity] sendRPENotification failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single workout activity
// ─────────────────────────────────────────────────────────────────────────────

/** Start the single persistent workout Live Activity. */
export async function startWorkoutActivity(workoutName: string): Promise<void> {
  console.log('[LiveActivity] startWorkoutActivity:', workoutName);
  const mod = getModule();
  if (!mod) return;

  // Stop in-memory activity (current session)
  await stopWorkoutActivity();

  // Also stop any stale activity from a previous JS load (survives hot reloads)
  try {
    const storedId = await AsyncStorage.getItem(ACTIVITY_ID_KEY);
    if (storedId && storedId !== workoutActivityId) {
      try { mod.stopActivity(storedId, { title: 'Workout ended' }); } catch {}
    }
    await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
  } catch {}

  currentWorkoutName = workoutName;

  try {
    const id = mod.startActivity(
      { title: workoutName, subtitle: 'Workout in progress' },
      { backgroundColor: '#000000', titleColor: '#FFFFFF', subtitleColor: 'rgba(255,255,255,0.65)' },
    );
    workoutActivityId = id ?? null;
    if (workoutActivityId) {
      await AsyncStorage.setItem(ACTIVITY_ID_KEY, workoutActivityId);
    }
    console.log('[LiveActivity] startWorkoutActivity → id:', workoutActivityId, 'raw:', id);
  } catch (e) {
    console.warn('[LiveActivity] startWorkoutActivity failed:', e);
  }
}

/** Stop the workout Live Activity (session complete or discarded). */
export async function stopWorkoutActivity(): Promise<void> {
  clearRevertTimer();
  pendingRestTimer = null;
  const mod = getModule();
  if (mod && workoutActivityId) {
    try {
      mod.stopActivity(workoutActivityId, { title: 'Workout complete' });
    } catch (e) {
      console.warn('[LiveActivity] stopWorkoutActivity error:', e);
    }
    workoutActivityId = null;
  }
  try { await AsyncStorage.removeItem(ACTIVITY_ID_KEY); } catch {}
}

/**
 * Animate the DI to show a rest timer countdown.
 * Auto-reverts to workout state when the countdown ends.
 */
export function updateToRestTimer(
  exerciseName: string,
  setNumber: number,
  durationSec: number,
): void {
  clearRevertTimer();
  const mod = getModule();
  console.log('[LiveActivity] updateToRestTimer', { exerciseName, setNumber, durationSec, workoutActivityId, hasMod: !!mod });
  if (!mod || !workoutActivityId) return;

  const endTimeMs = Date.now() + durationSec * 1000;
  pendingRestTimer = { exerciseName, setNumber, endTimeMs };
  try {
    mod.updateActivity(workoutActivityId, {
      title:    exerciseName,
      subtitle: `Rest · Set ${setNumber} complete`,
      progressBar: { date: endTimeMs },
    });
  } catch (e) {
    console.warn('[LiveActivity] updateToRestTimer failed:', e);
    pendingRestTimer = null;
    return;
  }

  revertTimer = setTimeout(() => {
    pendingRestTimer = null;
    revertToWorkoutState();
  }, durationSec * 1000 + 500);
}

/** Cancel rest timer or RPE animation early and revert to workout state. */
export function cancelRestTimerActivity(): void {
  pendingRestTimer = null;
  revertToWorkoutState();
}

export { revertToWorkoutState as revertWorkoutActivity };

/**
 * Animate the DI to show an RPE warning.
 * Auto-reverts to workout state after durationMs.
 */
export function updateToRPEWarning(
  rpe: number,
  exerciseName: string,
  durationMs = 8000,
): void {
  clearRevertTimer();
  const mod = getModule();
  if (!mod || !workoutActivityId) return;

  const endTimeMs = Date.now() + durationMs;
  try {
    mod.updateActivity(workoutActivityId, {
      title:    'Push Harder 💪',
      subtitle: `${exerciseName} · RPE ${rpe} — drive to 7+`,
      progressBar: { date: endTimeMs },
    });
  } catch (e) {
    console.warn('[LiveActivity] updateToRPEWarning failed:', e);
    return;
  }

  revertTimer = setTimeout(() => {
    // If a rest timer is still running, revert to it instead of workout state
    const rest = pendingRestTimer;
    const remainingMs = rest ? rest.endTimeMs - Date.now() : 0;
    if (rest && remainingMs > 1000) {
      const mod2 = getModule();
      if (mod2 && workoutActivityId) {
        try {
          mod2.updateActivity(workoutActivityId, {
            title:    rest.exerciseName,
            subtitle: `Rest · Set ${rest.setNumber} complete`,
            progressBar: { date: rest.endTimeMs },
          });
        } catch (e) {
          console.warn('[LiveActivity] revert-to-rest failed:', e);
          pendingRestTimer = null;
          revertToWorkoutState();
          return;
        }
        revertTimer = setTimeout(() => {
          pendingRestTimer = null;
          revertToWorkoutState();
        }, remainingMs + 500);
        return;
      }
    }
    pendingRestTimer = null;
    revertToWorkoutState();
  }, durationMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-session RPE (no workout activity running)
// ─────────────────────────────────────────────────────────────────────────────

/** Start a short-lived RPE activity after the session ends. */
export async function startRPEActivity(
  rpe: number,
  exerciseName: string,
  context: 'active' | 'post',
  durationMs = 8000,
): Promise<void> {
  const mod = getModule();
  if (!mod) return;

  await stopRPEActivity();

  const title    = context === 'active' ? 'Push Harder 💪' : 'Aim Higher Next Session';
  const subtitle = context === 'active'
    ? `${exerciseName} · RPE ${rpe} — drive to 7+`
    : `Avg RPE ${rpe} on ${exerciseName} — leave less in the tank`;
  const endTimeMs = Date.now() + durationMs;

  try {
    const id = mod.startActivity(
      { title, subtitle, progressBar: { date: endTimeMs } },
      { backgroundColor: '#000000', titleColor: '#FFFFFF', subtitleColor: '#FF9F0A', progressViewTint: '#FF9F0A', timerType: 'circular' },
    );
    postRPEActivityId = id ?? null;
  } catch (e) {
    console.warn('[LiveActivity] startRPEActivity failed:', e);
    return;
  }

  autoDismissPostRPETimer = setTimeout(stopRPEActivity, durationMs);
}

export async function stopRPEActivity(): Promise<void> {
  if (autoDismissPostRPETimer !== null) { clearTimeout(autoDismissPostRPETimer); autoDismissPostRPETimer = null; }
  const mod = getModule();
  if (!mod || !postRPEActivityId) return;
  try {
    mod.stopActivity(postRPEActivityId, { title: '' });
  } catch (e) {
    console.warn('[LiveActivity] stopRPEActivity error:', e);
  }
  postRPEActivityId = null;
}
