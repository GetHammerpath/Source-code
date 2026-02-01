-- Phase 1: Smart Batch - Add columns for row-based generation, sample runs, and retry logic
-- Conditional: only runs if tables exist (bulk_video_batches may not exist on all projects)

-- bulk_video_batches: source_type, total_rows, is_paused, sample_size (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bulk_video_batches') THEN
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'cartesian';
    
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS total_rows INTEGER;
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.bulk_video_batches ADD COLUMN IF NOT EXISTS sample_size INTEGER;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bulk_video_batches' AND column_name = 'metadata') THEN
      ALTER TABLE public.bulk_video_batches ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    
    COMMENT ON COLUMN public.bulk_video_batches.source_type IS 'Source of batch: cartesian (variable combinations), csv, ai, or mixed';
    COMMENT ON COLUMN public.bulk_video_batches.total_rows IS 'Total number of requested videos';
    COMMENT ON COLUMN public.bulk_video_batches.is_paused IS 'True when batch is paused for review (e.g. after sample run)';
    COMMENT ON COLUMN public.bulk_video_batches.sample_size IS 'Number of videos to generate before pausing; NULL means run all';
  END IF;
END $$;

-- kie_video_generations: is_sample (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kie_video_generations') THEN
    ALTER TABLE public.kie_video_generations ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN public.kie_video_generations.is_sample IS 'True if this video was part of a test/sample run';
  END IF;
END $$;
