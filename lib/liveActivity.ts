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
 *   await startWorkoutActivity('Push A');
 *   await updateWorkoutActivity('Bench Press', 3, 4);
 *   await stopWorkoutActivity();
 *
 *   // Rest Timer
 *   await startRestTimerActivity('Bench Press', 2, 90);
 *   await stopRestTimerActivity();
 */

import { Platform } from 'react-native';

// ─── Types (mirrors expo-live-activity 0.4.x JS API) ─────────────────────────
//
// IMPORTANT: expo-live-activity maps JS -> Swift like this:
//   state.progressBar.date         -> ContentState.timerEndDateInMilliseconds
//   state.progressBar.progress     -> ContentState.progress
//   state.progressBar.elapsedTimer.startDate -> ContentState.elapsedTimerStartDateInMilliseconds
//
// Do NOT pass timerEndDateInMilliseconds or progress at the top level of state —
// the native bridge ignores unknown top-level fields. Use progressBar.* instead.

type ProgressBar = {
  /** Epoch ms for countdown end — drives compact-trailing countdown timer */
  date?: number;
  /** 0–1 progress for static progress bar */
  progress?: number;
  /** Elapsed (count-up) timer — drives compact-trailing elapsed timer */
  elapsedTimer?: { startDate: number };
};

type LiveActivityState = {
  title: string;
  subtitle?: string;
  progressBar?: ProgressBar;
  imageName?: string;
  dynamicIslandImageName?: string;
};

type LiveActivityConfig = {
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  progressViewTint?: string;
  /** 'circular' (ring) | 'digital' (HH:MM text) */
  timerType?: 'circular' | 'digital';
};

type LiveActivityModule = {
  startActivity: (state: LiveActivityState, config?: LiveActivityConfig) => string | undefined;
  stopActivity:  (id: string, state: LiveActivityState) => void;
  updateActivity:(id: string, state: LiveActivityState) => void;
};

// ─── Lazy-load the native module (only available after a dev build) ───────────

function getModule(): LiveActivityModule | null {
  if (Platform.OS !== 'ios') {
    console.log('[LiveActivity] Skipping: not iOS (platform=' + Platform.OS + ')');
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-live-activity') as LiveActivityModule;
    if (!mod || typeof mod.startActivity !== 'function') {
      console.warn('[LiveActivity] Module loaded but startActivity is not a function. Check expo-live-activity installation.');
      return null;
    }
    return mod;
  } catch (e) {
    console.warn('[LiveActivity] Failed to load expo-live-activity native module:', e);
    console.warn('[LiveActivity] Make sure you built with Xcode (not Expo Go) and ran pod install.');
    return null;
  }
}

// ─── Activity IDs ────────────────────────────────────────────────────────────

let rpeActivityId:       string | null = null;
let workoutActivityId:   string | null = null;
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
  console.log('[LiveActivity] startRPEActivity called:', { rpe, exerciseName, context, durationMs });

  const mod = getModule();
  if (!mod) return;

  await stopRPEActivity();

  const title    = context === 'active' ? 'Push Harder 💪' : 'Aim Higher Next Session';
  const subtitle = context === 'active'
    ? `${exerciseName} · RPE ${rpe}  —  drive to 7+`
    : `Avg RPE ${rpe} on ${exerciseName}  —  leave less in the tank`;

  // Use a countdown equal to the auto-dismiss duration so the DI compact
  // trailing shows a shrinking ring/timer instead of an empty pill.
  const endTimeMs = Date.now() + durationMs;

  try {
    const id = mod.startActivity(
      {
        title,
        subtitle,
        // progressBar.date drives the compact-trailing countdown timer in Swift.
        progressBar: { date: endTimeMs },
      },
      {
        backgroundColor: '#000000',
        titleColor:      '#FFFFFF',
        subtitleColor:   '#FF9F0A',
        progressViewTint: '#FF9F0A',
        timerType:       'circular',
      },
    );
    rpeActivityId = id ?? null;
    console.log('[LiveActivity] startRPEActivity → id:', rpeActivityId);
  } catch (e) {
    console.warn('[LiveActivity] startRPEActivity failed:', e);
    return;
  }

  autoDismissRPETimer = setTimeout(stopRPEActivity, durationMs);
}

/**
 * Stop the current RPE Live Activity.
 */
export async function stopRPEActivity(): Promise<void> {
  console.log('[LiveActivity] stopRPEActivity called, id:', rpeActivityId);

  if (autoDismissRPETimer !== null) {
    clearTimeout(autoDismissRPETimer);
    autoDismissRPETimer = null;
  }

  const mod = getModule();
  if (!mod || !rpeActivityId) return;

  try {
    mod.stopActivity(rpeActivityId, { title: '' });
    console.log('[LiveActivity] stopRPEActivity: stopped', rpeActivityId);
  } catch (e) {
    console.warn('[LiveActivity] stopRPEActivity error (may already have ended):', e);
  }
  rpeActivityId = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Active Workout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a persistent workout Live Activity when the user begins a session.
 * Shows workout name + "Workout in progress" in Dynamic Island compact slots.
 *
 * @param workoutName   Name displayed as the DI title (e.g. "Push A")
 */
export async function startWorkoutActivity(
  workoutName: string,
): Promise<void> {
  console.log('[LiveActivity] startWorkoutActivity called:', { workoutName });

  const mod = getModule();
  if (!mod) return;

  // Stop any previous workout activity
  await stopWorkoutActivity();

  try {
    const id = mod.startActivity(
      {
        title:    workoutName,
        subtitle: 'Workout in progress',
        // expo-live-activity bridge does not support elapsedTimer —
        // DI compact trailing shows the subtitle text fallback instead.
      },
      {
        backgroundColor: '#000000',
        titleColor:      '#FFFFFF',
        subtitleColor:   'rgba(255,255,255,0.65)',
      },
    );
    workoutActivityId = id ?? null;
    console.log('[LiveActivity] startWorkoutActivity → id:', workoutActivityId);
  } catch (e) {
    console.warn('[LiveActivity] startWorkoutActivity failed:', e);
  }
}

/**
 * Update the workout Live Activity with the current exercise name and set info.
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
  console.log('[LiveActivity] updateWorkoutActivity called:', { exerciseName, setNumber, totalSets, workoutActivityId });

  const mod = getModule();
  if (!mod || !workoutActivityId) {
    console.log('[LiveActivity] updateWorkoutActivity: skipping — mod:', !!mod, 'id:', workoutActivityId);
    return;
  }

  try {
    mod.updateActivity(workoutActivityId, {
      title:    exerciseName,
      subtitle: `Set ${setNumber} of ${totalSets}`,
    });
    console.log('[LiveActivity] updateWorkoutActivity: updated', workoutActivityId);
  } catch (e) {
    console.warn('[LiveActivity] updateWorkoutActivity failed:', e);
  }
}

/**
 * Stop the workout Live Activity (called on discard or session complete).
 */
export async function stopWorkoutActivity(): Promise<void> {
  console.log('[LiveActivity] stopWorkoutActivity called, id:', workoutActivityId);

  const mod = getModule();
  if (!mod || !workoutActivityId) return;

  try {
    mod.stopActivity(workoutActivityId, { title: 'Workout complete' });
    console.log('[LiveActivity] stopWorkoutActivity: stopped', workoutActivityId);
  } catch (e) {
    console.warn('[LiveActivity] stopWorkoutActivity error (may already have ended):', e);
  }
  workoutActivityId = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Rest Timer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a countdown Live Activity for the rest period between sets.
 * Shows a circular countdown ring in DI compact trailing.
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
  console.log('[LiveActivity] startRestTimerActivity called:', { exerciseName, setNumber, durationSec });

  const mod = getModule();
  if (!mod) return;

  await stopRestTimerActivity();

  const endTimeMs = Date.now() + durationSec * 1000;

  try {
    const id = mod.startActivity(
      {
        title:    exerciseName,
        subtitle: `Rest · Set ${setNumber} complete`,
        // progressBar.date is the CORRECT field for a countdown timer.
        // The native bridge maps this to Swift ContentState.timerEndDateInMilliseconds.
        // Do NOT pass timerEndDateInMilliseconds directly — the bridge ignores it.
        progressBar: { date: endTimeMs },
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
    console.log('[LiveActivity] startRestTimerActivity → id:', restTimerActivityId, 'endTimeMs:', endTimeMs);

    // Auto-stop when the countdown ends (add 500 ms buffer for system latency)
    setTimeout(stopRestTimerActivity, durationSec * 1000 + 500);
  } catch (e) {
    console.warn('[LiveActivity] startRestTimerActivity failed:', e);
  }
}

/**
 * Stop the rest timer Live Activity early (user skipped or adjusted to 0).
 */
export async function stopRestTimerActivity(): Promise<void> {
  console.log('[LiveActivity] stopRestTimerActivity called, id:', restTimerActivityId);

  const mod = getModule();
  if (!mod || !restTimerActivityId) return;

  try {
    mod.stopActivity(restTimerActivityId, { title: 'Rest complete' });
    console.log('[LiveActivity] stopRestTimerActivity: stopped', restTimerActivityId);
  } catch (e) {
    console.warn('[LiveActivity] stopRestTimerActivity error (may already have ended):', e);
  }
  restTimerActivityId = null;
}
