/**
 * liveActivity.ts
 *
 * Thin wrapper around expo-live-activity for the TMLSN RPE notification.
 *
 * On DI iPhones (14 Pro+) this fires a real iOS Live Activity that lives
 * inside the Dynamic Island hardware and on the Lock Screen.
 * On older phones / Android the call is a no-op (the RN overlay handles it).
 *
 * DI layout produced by expo-live-activity's pre-built widget:
 *  Compact leading  : (nothing — no image provided)
 *  Compact trailing : (nothing — no timer provided)
 *  Expanded leading : title + subtitle in white
 *  Lock Screen      : same full-width card
 *
 * Usage:
 *   import { startRPEActivity, stopRPEActivity } from '../lib/liveActivity';
 *   await startRPEActivity(5, 'Bench Press', 'active');
 *   // auto-stops after 8 s, or call stopRPEActivity() on dismiss
 */

import { Platform } from 'react-native';

// ─── Types (mirrors expo-live-activity index.ts) ─────────────────────────────

type LiveActivityState = {
  title: string;
  subtitle?: string;
};

type LiveActivityConfig = {
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
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

// ─── State ────────────────────────────────────────────────────────────────────

let activeActivityId: string | null = null;
let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start an RPE Live Activity in the Dynamic Island.
 *
 * @param rpe           The RPE value that was logged (1–6 triggers this)
 * @param exerciseName  Name of the exercise (shown in DI expanded + badge)
 * @param context       'active' = mid-workout set; 'post' = after session ends
 * @param durationMs    How long to show before auto-stopping (default 8 s)
 */
export async function startRPEActivity(
  rpe: number,
  exerciseName: string,
  context: 'active' | 'post',
  durationMs = 8000,
): Promise<void> {
  const mod = getModule();
  if (!mod) return;   // silently no-op on Android / Expo Go

  // Stop any previous activity first
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
        subtitleColor:   '#FF9F0A',   // iOS system orange
      },
    );
    activeActivityId = id ?? null;
  } catch (e) {
    if (__DEV__) console.warn('[liveActivity] startActivity failed:', e);
    return;
  }

  // Auto-stop
  autoDismissTimer = setTimeout(stopRPEActivity, durationMs);
}

/**
 * Stop the current RPE Live Activity (called on user dismiss or auto-timeout).
 */
export async function stopRPEActivity(): Promise<void> {
  if (autoDismissTimer !== null) {
    clearTimeout(autoDismissTimer);
    autoDismissTimer = null;
  }

  const mod = getModule();
  if (!mod || !activeActivityId) return;

  try {
    mod.stopActivity(activeActivityId, { title: '', subtitle: '' });
  } catch {
    // already ended by the system — ignore
  }
  activeActivityId = null;
}
