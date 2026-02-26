-- 1) Add visibility to workout_sets for per-set notes
ALTER TABLE public.workout_sets ADD COLUMN IF NOT EXISTS notes_visibility text DEFAULT 'private';

-- 2) Create workout_posts table
CREATE TABLE IF NOT EXISTS public.workout_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (user_id, session_id) REFERENCES public.workout_sessions(user_id, id) ON DELETE CASCADE
);


-- Enable RLS
ALTER TABLE public.workout_posts ENABLE ROW LEVEL SECURITY;

-- 3) RLS Policies for workout_posts
CREATE POLICY "Anyone can read public posts" 
ON public.workout_posts FOR SELECT 
USING (visibility = 'public');

CREATE POLICY "Users can manage own posts"
ON public.workout_posts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4) Create Storage bucket for workout-images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('workout-images', 'workout-images', false) 
ON CONFLICT (id) DO NOTHING;

-- 5) RLS Policies for storage.objects
-- Note: Requires bucket_id = 'workout-images'
-- Owner can write/update/delete their own images
CREATE POLICY "Users can manage own workout images"
ON storage.objects FOR ALL
USING (bucket_id = 'workout-images' AND (select auth.uid()) = owner)
WITH CHECK (bucket_id = 'workout-images' AND (select auth.uid()) = owner);

-- Public can read images if they belong to a public post
-- We assume the object name is formatted as 'post_id/image.ext'
CREATE POLICY "Public can read public post images"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'workout-images' 
  AND EXISTS (
    SELECT 1 FROM public.workout_posts wp
    WHERE wp.id::text = (string_to_array(name, '/'))[1]
      AND wp.visibility = 'public'
  )
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workout_posts_updated_at ON public.workout_posts;
CREATE TRIGGER trg_workout_posts_updated_at
BEFORE UPDATE ON public.workout_posts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();