-- Add progress_hub_order to user_settings (widget order for Progress Hub)
-- Run in Supabase SQL Editor if your user_settings uses flat columns

ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS progress_hub_order JSONB DEFAULT '["progress","strength","history","activity","active-days","workouts"]'::jsonb;
