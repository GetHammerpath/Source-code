-- Create bulk_video_batches and bulk_batch_generations if they don't exist
-- Includes all columns from original schema + generation_mode, generation_type, Smart Batch columns

CREATE TABLE IF NOT EXISTS public.bulk_video_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  base_image_url TEXT,
  base_industry TEXT NOT NULL,
  base_city TEXT NOT NULL,
  base_story_idea TEXT,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_variations INTEGER NOT NULL DEFAULT 0,
  completed_variations INTEGER NOT NULL DEFAULT 0,
  failed_variations INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  model TEXT DEFAULT 'veo3_fast',
  aspect_ratio TEXT DEFAULT '16:9',
  number_of_scenes INTEGER DEFAULT 3,
  generation_mode TEXT DEFAULT 'all_combinations',
  generation_type TEXT DEFAULT 'REFERENCE_2_VIDEO',
  -- Smart Batch columns
  source_type TEXT DEFAULT 'cartesian',
  total_rows INTEGER,
  is_paused BOOLEAN DEFAULT FALSE,
  sample_size INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns that may be missing if table was created by older migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bulk_video_batches') THEN
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS generation_mode TEXT DEFAULT 'all_combinations';
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS generation_type TEXT DEFAULT 'REFERENCE_2_VIDEO';
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'cartesian';
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS total_rows INTEGER;
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS sample_size INTEGER;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_video_batches' AND column_name = 'metadata') THEN
      ALTER TABLE public.bulk_video_batches ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bulk_batch_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.bulk_video_batches(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES public.kie_video_generations(id) ON DELETE CASCADE,
  variable_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  variation_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bulk_video_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_batch_generations ENABLE ROW LEVEL SECURITY;

-- RLS policies (create only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bulk_video_batches' AND policyname = 'Users can view own batches') THEN
    CREATE POLICY "Users can view own batches" ON public.bulk_video_batches FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bulk_video_batches' AND policyname = 'Users can create own batches') THEN
    CREATE POLICY "Users can create own batches" ON public.bulk_video_batches FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bulk_video_batches' AND policyname = 'Users can update own batches') THEN
    CREATE POLICY "Users can update own batches" ON public.bulk_video_batches FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bulk_video_batches' AND policyname = 'Users can delete own batches') THEN
    CREATE POLICY "Users can delete own batches" ON public.bulk_video_batches FOR DELETE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bulk_batch_generations' AND policyname = 'Users can view own batch generations') THEN
    CREATE POLICY "Users can view own batch generations" ON public.bulk_batch_generations FOR SELECT
      USING (EXISTS (SELECT 1 FROM public.bulk_video_batches WHERE bulk_video_batches.id = bulk_batch_generations.batch_id AND bulk_video_batches.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bulk_batch_generations' AND policyname = 'Users can create batch generations') THEN
    CREATE POLICY "Users can create batch generations" ON public.bulk_batch_generations FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM public.bulk_video_batches WHERE bulk_video_batches.id = bulk_batch_generations.batch_id AND bulk_video_batches.user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bulk_batch_generations' AND policyname = 'Users can delete batch generations') THEN
    CREATE POLICY "Users can delete batch generations" ON public.bulk_batch_generations FOR DELETE
      USING (EXISTS (SELECT 1 FROM public.bulk_video_batches WHERE bulk_video_batches.id = bulk_batch_generations.batch_id AND bulk_video_batches.user_id = auth.uid()));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bulk_video_batches_user_id ON public.bulk_video_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_video_batches_status ON public.bulk_video_batches(status);
CREATE INDEX IF NOT EXISTS idx_bulk_batch_generations_batch_id ON public.bulk_batch_generations(batch_id);
CREATE INDEX IF NOT EXISTS idx_bulk_batch_generations_generation_id ON public.bulk_batch_generations(generation_id);

-- Trigger for updated_at (only if function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_bulk_video_batches_updated_at ON public.bulk_video_batches;
    CREATE TRIGGER update_bulk_video_batches_updated_at
      BEFORE UPDATE ON public.bulk_video_batches
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
