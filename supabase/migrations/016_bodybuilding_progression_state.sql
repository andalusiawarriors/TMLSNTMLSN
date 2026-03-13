-- ============================================================
-- 016_bodybuilding_progression_state.sql
-- Adds live rep target and range to exercise_progress_state for
-- the bodybuilding-only progression algorithm.
-- ============================================================

ALTER TABLE public.exercise_progress_state
  ADD COLUMN IF NOT EXISTS next_target_reps INTEGER,
  ADD COLUMN IF NOT EXISTS rep_range_low   INTEGER,
  ADD COLUMN IF NOT EXISTS rep_range_high  INTEGER;

COMMENT ON COLUMN public.exercise_progress_state.next_target_reps
  IS 'Live rep target inside range (e.g. 10, 11, 12 for 10–12). Replaces next_goal_type for bodybuilding.';

COMMENT ON COLUMN public.exercise_progress_state.rep_range_low
  IS 'Bottom of rep range when prescription was written (e.g. 10).';

COMMENT ON COLUMN public.exercise_progress_state.rep_range_high
  IS 'Top of rep range when prescription was written (e.g. 12).';
