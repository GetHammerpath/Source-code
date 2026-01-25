-- Ensure video_jobs table exists with all required columns
-- This fixes "Could not find the table 'public.video_jobs' in the schema cache" errors

CREATE TABLE IF NOT EXISTS public.video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.kie_video_generations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- 'kie', 'fal', etc.
  estimated_minutes DECIMAL(10, 2),
  actual_minutes DECIMAL(10, 2),
  estimated_credits INTEGER,
  credits_charged INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded'
  credits_reserved INTEGER DEFAULT 0, -- Reserved but not yet charged
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB,
  
  -- Additional columns from admin migration
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  started_at TIMESTAMPTZ
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_video_jobs_user_id ON public.video_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_generation_id ON public.video_jobs(generation_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON public.video_jobs(status);

-- Enable RLS
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'video_jobs'
    AND policyname = 'Users can view own video jobs'
  ) THEN
    CREATE POLICY "Users can view own video jobs"
      ON public.video_jobs FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'video_jobs'
    AND policyname = 'Users can create own video jobs'
  ) THEN
    CREATE POLICY "Users can create own video jobs"
      ON public.video_jobs FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Verify table is accessible
DO $$
BEGIN
  PERFORM 1 FROM public.video_jobs LIMIT 1;
  RAISE NOTICE 'video_jobs table verified and accessible';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not verify video_jobs table: %', SQLERRM;
END $$;
