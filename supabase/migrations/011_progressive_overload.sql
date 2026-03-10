-- ============================================================
-- 011_progressive_overload.sql
-- Adds difficulty band system, calibration flag, Blitz Mode,
-- and deload week counter to support the progressive overload
-- algorithm defined in progressive_overload_algorithm.docx
-- ============================================================


-- ─── 1. exercise_progress_state — add band tracking columns ──

ALTER TABLE public.exercise_progress_state
  ADD COLUMN IF NOT EXISTS difficulty_band       TEXT    NOT NULL DEFAULT 'easy'
    CHECK (difficulty_band IN ('easy', 'medium', 'hard', 'extreme')),
  ADD COLUMN IF NOT EXISTS consecutive_success   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consecutive_failure   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_calibrating        BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.exercise_progress_state.difficulty_band
  IS 'Current difficulty band: easy | medium | hard | extreme. Managed automatically by the algorithm.';

COMMENT ON COLUMN public.exercise_progress_state.consecutive_success
  IS 'Consecutive sessions hitting 70%+ of max reps. 1 in a row moves band up.';

COMMENT ON COLUMN public.exercise_progress_state.consecutive_failure
  IS 'Consecutive sessions failing the 70% threshold. 2 in a row drops the band.';

COMMENT ON COLUMN public.exercise_progress_state.is_calibrating
  IS 'TRUE on first session for a new exercise — no increment applied, just sets baseline. FALSE from session 2 onward.';


-- ─── 2. training_settings — create if missing, then add columns ──

CREATE TABLE IF NOT EXISTS public.training_settings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume_framework     TEXT NOT NULL DEFAULT 'builder',
  schedule_mode        TEXT,
  current_week         INT  NOT NULL DEFAULT 1,
  blitz_mode           BOOLEAN NOT NULL DEFAULT FALSE,
  deload_week_counter  INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- If the table already existed without the new columns, add them safely
ALTER TABLE public.training_settings
  ADD COLUMN IF NOT EXISTS blitz_mode           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deload_week_counter  INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.training_settings.blitz_mode
  IS 'When TRUE: forces Extreme band, disables coaching prompts, RPE warnings, and auto-deload. Premium feature.';

COMMENT ON COLUMN public.training_settings.deload_week_counter
  IS 'Increments each week. Every 4th week triggers auto-deload. Resets after deload or a 7+ day break.';

ALTER TABLE public.training_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own training_settings"
    ON public.training_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
