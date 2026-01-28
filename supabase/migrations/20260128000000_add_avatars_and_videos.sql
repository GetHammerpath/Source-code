-- Phase 1: Identity-based core entities (Avatar)
-- - Create `avatars`
-- - Ensure `videos.avatar_id` exists and is required for NEW rows

-- 1) Avatars
CREATE TABLE IF NOT EXISTS public.avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  seed_image_url TEXT NOT NULL,
  voice_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatars' AND policyname = 'Users can view own avatars'
  ) THEN
    CREATE POLICY "Users can view own avatars"
      ON public.avatars FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatars' AND policyname = 'Users can create own avatars'
  ) THEN
    CREATE POLICY "Users can create own avatars"
      ON public.avatars FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatars' AND policyname = 'Users can update own avatars'
  ) THEN
    CREATE POLICY "Users can update own avatars"
      ON public.avatars FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatars' AND policyname = 'Users can delete own avatars'
  ) THEN
    CREATE POLICY "Users can delete own avatars"
      ON public.avatars FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_avatars_user_id ON public.avatars(user_id);
CREATE INDEX IF NOT EXISTS idx_avatars_created_at ON public.avatars(created_at DESC);

-- 2) Videos
-- If `public.videos` doesn't exist in this repo yet, create a minimal table to support the new identity-based model.
-- If it *does* exist already (e.g. created manually), we only add the new relationship pieces.
CREATE TABLE IF NOT EXISTS public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Ensure column exists (in case videos table already existed without it)
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS avatar_id UUID;

-- Add FK if missing (by name)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'videos'
      AND c.conname = 'videos_avatar_id_fkey'
  ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT videos_avatar_id_fkey
      FOREIGN KEY (avatar_id)
      REFERENCES public.avatars(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- Make avatar_id required for NEW rows without breaking existing rows:
-- NOT VALID skips checking existing rows, but still enforces for new inserts/updates.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'videos'
      AND c.conname = 'videos_avatar_id_required'
  ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT videos_avatar_id_required
      CHECK (avatar_id IS NOT NULL)
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_videos_avatar_id ON public.videos(avatar_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'Users can view own videos'
  ) THEN
    CREATE POLICY "Users can view own videos"
      ON public.videos FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'Users can create own videos'
  ) THEN
    CREATE POLICY "Users can create own videos"
      ON public.videos FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'Users can update own videos'
  ) THEN
    CREATE POLICY "Users can update own videos"
      ON public.videos FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'videos' AND policyname = 'Users can delete own videos'
  ) THEN
    CREATE POLICY "Users can delete own videos"
      ON public.videos FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

