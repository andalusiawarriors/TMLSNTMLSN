/**
 * RPE (Rate of Perceived Exertion) → Reps-In-Reserve label for the picker.
 * Shared by active workout and edit past workout set tables.
 */
export const LOW_RPE_WARNING_THRESHOLD = 7;

/** Low-effort warning rule used by workout feedback surfaces. */
export function shouldTriggerLowRpeWarning(rpe: number | null | undefined): rpe is number {
  return rpe != null && rpe < LOW_RPE_WARNING_THRESHOLD;
}

export function getRpeLabel(rpe: number): string {
  const rir = 10 - rpe;
  if (rir <= 0) return 'Max effort — no reps left';
  if (rir <= 0.5) return 'Could barely squeeze out 1 more';
  if (rir <= 1) return 'Could do 1 more rep';
  if (rir <= 1.5) return 'Could do 1–2 more reps';
  if (rir <= 2) return 'Could do 2 more reps';
  if (rir <= 2.5) return 'Could do 2–3 more reps';
  if (rir <= 3) return 'Could do 3 more reps';
  if (rir <= 3.5) return 'Could do 3–4 more reps';
  if (rir <= 4) return 'Could do 4 more reps';
  if (rir <= 5) return 'Could do 5 more reps';
  return `Could do ${Math.round(rir)}+ more reps`;
}
