-- Phase 3: Golden Sample safety gate (bulk upload batches)

-- 1) Batch headers
CREATE TABLE IF NOT EXISTS public.avatar_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id UUID NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'locked', -- locked | approved | running | completed | failed
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

ALTER TABLE public.avatar_batches ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_avatar_batches_user_id ON public.avatar_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_batches_avatar_id ON public.avatar_batches(avatar_id);
CREATE INDEX IF NOT EXISTS idx_avatar_batches_created_at ON public.avatar_batches(created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_batches' AND policyname = 'Users can view own avatar batches'
  ) THEN
    CREATE POLICY "Users can view own avatar batches"
      ON public.avatar_batches FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_batches' AND policyname = 'Users can create own avatar batches'
  ) THEN
    CREATE POLICY "Users can create own avatar batches"
      ON public.avatar_batches FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_batches' AND policyname = 'Users can update own avatar batches'
  ) THEN
    CREATE POLICY "Users can update own avatar batches"
      ON public.avatar_batches FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_batches' AND policyname = 'Users can delete own avatar batches'
  ) THEN
    CREATE POLICY "Users can delete own avatar batches"
      ON public.avatar_batches FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Keep updated_at current
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_avatar_batches_updated_at ON public.avatar_batches;
    CREATE TRIGGER update_avatar_batches_updated_at
      BEFORE UPDATE ON public.avatar_batches
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Batch rows
CREATE TABLE IF NOT EXISTS public.avatar_batch_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.avatar_batches(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed | skipped
  generation_id UUID REFERENCES public.kie_video_generations(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.avatar_batch_rows ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_avatar_batch_rows_batch_id ON public.avatar_batch_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_avatar_batch_rows_status ON public.avatar_batch_rows(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_batch_rows' AND policyname = 'Users can view own avatar batch rows'
  ) THEN
    CREATE POLICY "Users can view own avatar batch rows"
      ON public.avatar_batch_rows FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.avatar_batches b
          WHERE b.id = batch_id AND b.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_batch_rows' AND policyname = 'Users can create own avatar batch rows'
  ) THEN
    CREATE POLICY "Users can create own avatar batch rows"
      ON public.avatar_batch_rows FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.avatar_batches b
          WHERE b.id = batch_id AND b.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_batch_rows' AND policyname = 'Users can update own avatar batch rows'
  ) THEN
    CREATE POLICY "Users can update own avatar batch rows"
      ON public.avatar_batch_rows FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.avatar_batches b
          WHERE b.id = batch_id AND b.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'avatar_batch_rows' AND policyname = 'Users can delete own avatar batch rows'
  ) THEN
    CREATE POLICY "Users can delete own avatar batch rows"
      ON public.avatar_batch_rows FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.avatar_batches b
          WHERE b.id = batch_id AND b.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_avatar_batch_rows_updated_at ON public.avatar_batch_rows;
    CREATE TRIGGER update_avatar_batch_rows_updated_at
      BEFORE UPDATE ON public.avatar_batch_rows
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

