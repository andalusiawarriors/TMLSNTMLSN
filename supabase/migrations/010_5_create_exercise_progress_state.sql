-- ============================================================
-- 010_5_create_exercise_progress_state.sql
-- Creates exercise_progress_state table if not exists.
-- Required before 011_progressive_overload.sql which ALTERs it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exercise_progress_state (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id          TEXT NOT NULL,
  variant_key          TEXT NOT NULL DEFAULT 'default',
  next_target_weight   FLOAT,
  next_goal_type       TEXT,
  difficulty_band      TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty_band IN ('easy', 'medium', 'hard', 'extreme')),
  consecutive_success  INTEGER NOT NULL DEFAULT 0,
  consecutive_failure  INTEGER NOT NULL DEFAULT 0,
  is_calibrating       BOOLEAN NOT NULL DEFAULT TRUE,
  progression_reason   TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id, variant_key)
);

CREATE INDEX IF NOT EXISTS exercise_progress_state_user_id_idx
  ON public.exercise_progress_state (user_id);

CREATE INDEX IF NOT EXISTS exercise_progress_state_exercise_id_idx
  ON public.exercise_progress_state (exercise_id);

ALTER TABLE public.exercise_progress_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can manage own exercise_progress_state"
    ON public.exercise_progress_state
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
