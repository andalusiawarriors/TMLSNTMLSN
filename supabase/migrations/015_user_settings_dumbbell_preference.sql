-- Add dumbbell weight preference and body map gender to user_settings
-- (if table uses normalized columns; no-op if columns already exist)

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS body_map_gender TEXT CHECK (body_map_gender IN ('male', 'female'));

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS dumbbell_weight_preference TEXT CHECK (dumbbell_weight_preference IN ('per_hand', 'total'));
