-- ============================================================
-- 014_user_exercises.sql
-- User-created custom exercises. RLS: user sees only own rows.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_exercises (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,
  equipment         TEXT[] NOT NULL DEFAULT '{}',
  movement_type     TEXT NOT NULL,
  force_type        TEXT NOT NULL,
  overload_category TEXT NOT NULL DEFAULT 'isolation',
  laterality        TEXT CHECK (laterality IN ('bilateral', 'unilateral')),
  load_entry_mode   TEXT NOT NULL DEFAULT 'total' CHECK (load_entry_mode IN ('total', 'per_hand', 'per_side')),
  base_movement_id  TEXT,
  aliases           TEXT[] DEFAULT '{}',
  muscles           JSONB DEFAULT '[]',
  description       TEXT,
  tips              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_exercises_user_id_idx
  ON public.user_exercises (user_id);

ALTER TABLE public.user_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own user_exercises"
  ON public.user_exercises
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_user_exercises_updated_at ON public.user_exercises;
CREATE TRIGGER trg_user_exercises_updated_at
  BEFORE UPDATE ON public.user_exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
