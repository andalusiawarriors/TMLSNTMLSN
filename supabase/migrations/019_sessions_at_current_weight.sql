-- ============================================================
-- 019_sessions_at_current_weight.sql
-- Adds sessions_at_current_weight to exercise_progress_state
-- to support the new-weight grace period (item #7).
--
-- Grace period: first 2 sessions at a new weight are adaptation
-- sessions. Misses during grace do NOT increment consecutive_failure
-- or drop the difficulty band.
--
-- Reset to 0 on every weight increase.
-- Incremented by 1 on every non-weight-increase session.
-- ============================================================

ALTER TABLE public.exercise_progress_state
  ADD COLUMN IF NOT EXISTS sessions_at_current_weight INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.exercise_progress_state.sessions_at_current_weight
  IS 'Sessions completed at the current working weight since the last weight increase. Misses during the first 2 sessions (grace period) are ignored — user is still adapting to the new load. Reset to 0 on every weight increase.';
