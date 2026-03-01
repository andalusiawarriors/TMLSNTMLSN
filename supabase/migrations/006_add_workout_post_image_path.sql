-- Add image_path to workout_posts for private workout-images bucket.
-- Posts store path like 'postId/timestamp.jpg' for createSignedUrl() rendering.
-- Run: supabase db push or supabase migration up
ALTER TABLE public.workout_posts ADD COLUMN IF NOT EXISTS image_path TEXT;
