-- ============================================================
-- 017_consecutive_at_top.sql
-- Adds consecutive_at_top to exercise_progress_state.
-- The weight-increase gate requires 2 consecutive sessions
-- where the rep cursor is at repRangeHigh and the threshold
-- is hit, before adding weight.
-- ============================================================

ALTER TABLE public.exercise_progress_state
  ADD COLUMN IF NOT EXISTS consecutive_at_top INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.exercise_progress_state.consecutive_at_top
  IS 'How many consecutive sessions the cursor was at repRangeHigh and the threshold was hit. Weight increases when this reaches 2.';
