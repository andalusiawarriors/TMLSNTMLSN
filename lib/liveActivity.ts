/**
 * liveActivity.ts
 *
 * Thin wrapper around expo-live-activity for TMLSN Dynamic Island features.
 *
 * Three activity types are supported:
 *
 *  1. RPE Warning  — fires after a low-RPE set or post-session
 *  2. Workout      — persistent elapsed-timer shown while a workout is active
 *  3. Rest Timer   — countdown shown between sets in DI compact trailing
 *
 * On DI iPhones (14 Pro+) these appear in the Dynamic Island hardware and
 * on the Lock Screen.  On older phones / Android the calls are no-ops — the
 * React-Native overlay (DynamicIslandRPEWarning) handles the visual feedback.
 *
 * Usage:
 *   // RPE
 *   await startRPEActivity(5, 'Bench Press', 'active');
 *   await stopRPEActivity();
 *
 *   // Workout
 *   await startWorkoutActivity('Push A', Date.now());
 *   await updateWorkoutActivity('Bench Press', 3, 4);
 *   await stopWorkoutActivity();
 *
 *   // Rest Timer
 *   await startRestTimerActivity('Bench Press', 2, 90);
 *   await stopRestTimerActivity();
 */

import { Platform } from 'react-native';

// ─── Types (mirrors expo-live-activity ContentState + Attributes) ─────────────

type LiveActivityState = {
  title: string;
  subtitle?: string;
  /** Millisecond epoch for countdown end — drives compact-trailing timer */
  timerEndDateInMilliseconds?: number;
  /** 0–1 progress shown in expanded bottom bar */
  progress?: number;
};

type LiveActivityConfig = {
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  progressViewTint?: string;
  /** 'circular' (default ring) | 'digital' (HH:MM text) */
  timerType?: 'circular' | 'digital';
};

type LiveActivityModule = {
  startActivity: (state: LiveActivityState, config?: LiveActivityConfig) => string | undefined;
  stopActivity:  (id: string, state: LiveActivityState) => void;
  updateActivity:(id: string, state: LiveActivityState) => void;
};

// ─── Lazy-load the native module (only available after a dev build) ───────────

function getModule(): LiveActivityModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-live-activity') as LiveActivityModule;
  } catch {
    return null;
  }
}

// ─── Activity IDs ────────────────────────────────────────────────────────────

let rpeActivityId:      string | null = null;
let workoutActivityId:  string | null = null;
let restTimerActivityId: string | null = null;

let autoDismissRPETimer: ReturnType<typeof setTimeout> | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// 1. RPE Warning
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start an RPE Live Activity in the Dynamic Island.
 *
 * @param rpe           The RPE value logged (1–6 triggers this)
 * @param exerciseName  Exercise shown in the DI expanded view + badge
 * @param context       'active' = mid-workout set; 'post' = after session ends
 * @param durationMs    Auto-stop delay (default 8 s)
 */
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
    ? `${exerciseName} · RPE ${rpe}  —  drive to 7+`
    : `Avg RPE ${rpe} on ${exerciseName}  —  leave less in the tank`;

  try {
    const id = mod.startActivity(
      { title, subtitle },
      {
        backgroundColor: '#000000',
        titleColor:      '#FFFFFF',
        subtitleColor:   '#FF9F0A',
      },
    );
    rpeActivityId = id ?? null;
  } catch (e) {
    if (__DEV__) console.warn('[liveActivity] startRPEActivity failed:', e);
    return;
  }

  autoDismissRPETimer = setTimeout(stopRPEActivity, durationMs);
}

/**
 * Stop the current RPE Live Activity.
 */
export async function stopRPEActivity(): Promise<void> {
  if (autoDismissRPETimer !== null) {
    clearTimeout(autoDismissRPETimer);
    autoDismissRPETimer = null;
  }

  const mod = getModule();
  if (!mod || !rpeActivityId) return;

  try {
    mod.stopActivity(rpeActivityId, { title: '' });
  } catch {
    // already ended by system
  }
  rpeActivityId = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Active Workout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a persistent workout Live Activity when the user begins a session.
 * Shown in Dynamic Island compact/expanded while the app is in background.
 *
 * @param workoutName   Name displayed as the DI title (e.g. "Push A")
 * @param startTimeMs   epoch ms of when workout started (Date.now())
 */
export async function startWorkoutActivity(
  workoutName: string,
  startTimeMs: number,
): Promise<void> {
  const mod = getModule();
  if (!mod) return;

  // Stop any previous workout activity
  await stopWorkoutActivity();

  try {
    const id = mod.startActivity(
      {
        title:    workoutName,
        subtitle: 'Workout in progress',
        // No timerEndDateInMilliseconds — elapsed display handled by subtitle updates
      },
      {
        backgroundColor: '#000000',
        titleColor:      '#FFFFFF',
        subtitleColor:   'rgba(255,255,255,0.65)',
      },
    );
    workoutActivityId = id ?? null;
  } catch (e) {
    if (__DEV__) console.warn('[liveActivity] startWorkoutActivity failed:', e);
  }
}

/**
 * Update the workout Live Activity subtitle with the current exercise name.
 * Call when the user moves to a new exercise.
 *
 * @param exerciseName  Current exercise being performed
 * @param setNumber     1-based set number (e.g. 3 for third set)
 * @param totalSets     Total sets in this exercise
 */
export async function updateWorkoutActivity(
  exerciseName: string,
  setNumber: number,
  totalSets: number,
): Promise<void> {
  const mod = getModule();
  if (!mod || !workoutActivityId) return;

  try {
    mod.updateActivity(workoutActivityId, {
      title:    exerciseName,
      subtitle: `Set ${setNumber} of ${totalSets}`,
    });
  } catch (e) {
    if (__DEV__) console.warn('[liveActivity] updateWorkoutActivity failed:', e);
  }
}

/**
 * Stop the workout Live Activity (called on discard or session complete).
 */
export async function stopWorkoutActivity(): Promise<void> {
  const mod = getModule();
  if (!mod || !workoutActivityId) return;

  try {
    mod.stopActivity(workoutActivityId, { title: 'Workout complete' });
  } catch {
    // already ended
  }
  workoutActivityId = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rest Timer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a countdown Live Activity for the rest period between sets.
 * Shows a circular countdown in DI compact trailing.
 *
 * @param exerciseName  Exercise name shown in expanded DI view
 * @param setNumber     1-based set number just completed
 * @param durationSec   Rest duration in seconds
 */
export async function startRestTimerActivity(
  exerciseName: string,
  setNumber: number,
  durationSec: number,
): Promise<void> {
  const mod = getModule();
  if (!mod) return;

  await stopRestTimerActivity();

  const endTimeMs = Date.now() + durationSec * 1000;

  try {
    const id = mod.startActivity(
      {
        title:    exerciseName,
        subtitle: `Rest · Set ${setNumber} complete`,
        timerEndDateInMilliseconds: endTimeMs,
      },
      {
        backgroundColor:  '#000000',
        titleColor:       '#FFFFFF',
        subtitleColor:    'rgba(255,255,255,0.65)',
        progressViewTint: '#34C759',   // iOS system green
        timerType:        'circular',
      },
    );
    restTimerActivityId = id ?? null;

    // Auto-stop when the countdown ends (add 500 ms buffer for system latency)
    setTimeout(stopRestTimerActivity, durationSec * 1000 + 500);
  } catch (e) {
    if (__DEV__) console.warn('[liveActivity] startRestTimerActivity failed:', e);
  }
}

/**
 * Stop the rest timer Live Activity early (user skipped or adjusted to 0).
 */
export async function stopRestTimerActivity(): Promise<void> {
  const mod = getModule();
  if (!mod || !restTimerActivityId) return;

  try {
    mod.stopActivity(restTimerActivityId, { title: 'Rest complete' });
  } catch {
    // already ended
  }
  restTimerActivityId = null;
}
