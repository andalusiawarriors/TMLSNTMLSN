-- Add notes column to workout_sets table
ALTER TABLE public.workout_sets ADD COLUMN IF NOT EXISTS notes text;
