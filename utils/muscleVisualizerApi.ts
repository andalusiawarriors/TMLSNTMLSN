// ============================================================
// TMLSN — Muscle Visualizer API client
// Mirrors design from https://muscle-visualizer.exercisedb.dev/docs
// Three modes: heatmap, muscle highlight, workout activation.
// Front/back, male/female, custom colors (C6C6C6 / 2F3031).
// ============================================================

const BASE_URL = 'https://muscle-visualizer-api.p.rapidapi.com';
const HOST = 'muscle-visualizer-api.p.rapidapi.com';

// App colors — match TMLSN theme (no gold)
export const MUSCLE_VIZ_COLORS = {
  primaryLight: '#C6C6C6',
  primaryDark: '#2F3031',
  highlight: '#C6C6C6',
  primary: '#C6C6C6',
  secondary: '#8A8A8A',
} as const;

export type MuscleVizView = 'front' | 'back';
export type MuscleVizGender = 'male' | 'female';
export type MuscleVizFormat = 'png' | 'jpeg' | 'webp';

/** Muscle group names accepted by the API (common slug format) */
export type MuscleVizSlug =
  | 'biceps'
  | 'triceps'
  | 'chest'
  | 'back'
  | 'lats'
  | 'traps'
  | 'shoulders'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'hip_flexors'
  | string;

/** Map our MuscleGroup (from exerciseDb) to API slug when needed */
export const MUSCLE_GROUP_TO_SLUG: Record<string, string> = {
  chest: 'chest',
  upper_back: 'back',
  lats: 'lats',
  lower_back: 'back',
  traps: 'traps',
  front_delts: 'shoulders',
  side_delts: 'shoulders',
  rear_delts: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abs: 'abs',
  obliques: 'obliques',
  quads: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  adductors: 'adductors',
  calves: 'calves',
  hip_flexors: 'hip_flexors',
};

function getApiKey(): string | null {
  try {
    const key = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_RAPIDAPI_KEY;
    return (key && String(key).trim()) || null;
  } catch {
    return null;
  }
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') search.set(k, String(v));
  });
  const q = search.toString();
  return q ? `?${q}` : '';
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a! >> 2];
    out += B64[((a! & 3) << 4) | (b ?? 0) >> 4];
    out += b !== undefined ? B64[((b & 15) << 2) | (c ?? 0) >> 6] : '=';
    out += c !== undefined ? B64[c & 63] : '=';
  }
  return out;
}

/**
 * Fetch image from API and return a data URI so React Native Image can display it
 * (API requires auth header so we can't use image URL directly).
 */
async function fetchImageAsDataUri(url: string, apiKey: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': apiKey,
      'X-RapidAPI-Host': HOST,
    },
  });
  if (!res.ok) throw new Error(`Muscle Visualizer API: ${res.status} ${res.statusText}`);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(buf);
  const mime = res.headers.get('content-type') || 'image/png';
  return `data:${mime};base64,${base64}`;
}

// ── 1) Muscle group highlighting (single color) ─────────────────────────────
// Design: "Create simple, clear muscle diagrams with specified groups highlighted."

export interface VisualizeMusclesParams {
  muscles: MuscleVizSlug[];
  color?: string;
  view?: MuscleVizView;
  gender?: MuscleVizGender;
  background?: string;
  width?: number;
  height?: number;
  format?: MuscleVizFormat;
}

export function buildVisualizeMusclesUrl(params: VisualizeMusclesParams): string {
  const {
    muscles,
    color = MUSCLE_VIZ_COLORS.highlight,
    view = 'front',
    gender = 'male',
    background = MUSCLE_VIZ_COLORS.primaryDark,
    width,
    height,
    format = 'png',
  } = params;
  const musclesStr = Array.isArray(muscles) ? muscles.join(',') : muscles;
  const query = buildQuery({
    muscles: musclesStr,
    color: color.startsWith('#') ? color : `#${color}`,
    view,
    gender,
    background: background.startsWith('#') ? background : `#${background}`,
    width,
    height,
    format,
  });
  return `${BASE_URL}/v1/visualize/muscles${query}`;
}

export async function fetchVisualizeMuscles(params: VisualizeMusclesParams): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('EXPO_PUBLIC_RAPIDAPI_KEY not set');
  const url = buildVisualizeMusclesUrl(params);
  return fetchImageAsDataUri(url, key);
}

// ── 2) Heatmap visualization (intensity per muscle) ──────────────────────────
// Design: "Each muscle group displays a unique color" / intensity mapping.

export interface HeatmapEntry {
  muscle: MuscleVizSlug;
  /** 0–1 or 0–100 intensity */
  value: number;
  /** Optional hex color; otherwise derived from value */
  color?: string;
}

export interface VisualizeHeatmapParams {
  /** Muscle intensities (0–1 or 0–100). API may expect a specific format. */
  heatmap?: HeatmapEntry[] | Record<string, number>;
  view?: MuscleVizView;
  gender?: MuscleVizGender;
  background?: string;
  width?: number;
  height?: number;
  format?: MuscleVizFormat;
}

export function buildVisualizeHeatmapUrl(params: VisualizeHeatmapParams): string {
  const {
    view = 'front',
    gender = 'male',
    background = MUSCLE_VIZ_COLORS.primaryDark,
    width,
    height,
    format = 'png',
  } = params;
  const query = buildQuery({
    view,
    gender,
    background: background.startsWith('#') ? background : `#${background}`,
    width,
    height,
    format,
  });
  return `${BASE_URL}/v1/visualize/heatmap${query}`;
}

export async function fetchVisualizeHeatmap(params: VisualizeHeatmapParams): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('EXPO_PUBLIC_RAPIDAPI_KEY not set');
  const url = buildVisualizeHeatmapUrl(params);
  return fetchImageAsDataUri(url, key);
}

// ── 3) Workout activation (primary + secondary muscles) ─────────────────────
// Design: "Display primary and secondary muscle activation with two distinct colors."

export interface VisualizeWorkoutParams {
  primaryMuscles?: MuscleVizSlug[];
  secondaryMuscles?: MuscleVizSlug[];
  primaryColor?: string;
  secondaryColor?: string;
  view?: MuscleVizView;
  gender?: MuscleVizGender;
  background?: string;
  width?: number;
  height?: number;
  format?: MuscleVizFormat;
}

export function buildVisualizeWorkoutUrl(params: VisualizeWorkoutParams): string {
  const {
    primaryMuscles = [],
    secondaryMuscles = [],
    primaryColor = MUSCLE_VIZ_COLORS.primaryLight,
    secondaryColor = MUSCLE_VIZ_COLORS.secondary,
    view = 'front',
    gender = 'male',
    background = MUSCLE_VIZ_COLORS.primaryDark,
    width,
    height,
    format = 'png',
  } = params;
  const query = buildQuery({
    primary: Array.isArray(primaryMuscles) ? primaryMuscles.join(',') : primaryMuscles,
    secondary: Array.isArray(secondaryMuscles) ? secondaryMuscles.join(',') : secondaryMuscles,
    primaryColor: primaryColor.startsWith('#') ? primaryColor : `#${primaryColor}`,
    secondaryColor: secondaryColor.startsWith('#') ? secondaryColor : `#${secondaryColor}`,
    view,
    gender,
    background: background.startsWith('#') ? background : `#${background}`,
    width,
    height,
    format,
  });
  return `${BASE_URL}/v1/visualize/workout${query}`;
}

export async function fetchVisualizeWorkout(params: VisualizeWorkoutParams): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('EXPO_PUBLIC_RAPIDAPI_KEY not set');
  const url = buildVisualizeWorkoutUrl(params);
  return fetchImageAsDataUri(url, key);
}

// ── 4) List muscles (for dropdowns / validation) ───────────────────────────

export async function fetchMusclesList(): Promise<{ muscles?: string[] }> {
  const key = getApiKey();
  if (!key) throw new Error('EXPO_PUBLIC_RAPIDAPI_KEY not set');
  const res = await fetch(`${BASE_URL}/v1/muscles`, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': HOST,
    },
  });
  if (!res.ok) throw new Error(`Muscle Visualizer API: ${res.status} ${res.statusText}`);
  return res.json();
}

export function isMuscleVisualizerConfigured(): boolean {
  return !!getApiKey();
}
