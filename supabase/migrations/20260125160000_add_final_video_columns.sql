-- Add missing final_video columns to kie_video_generations table
-- This fixes "Could not find the 'final_video_completed_at' column" error

-- Add final_video_completed_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'kie_video_generations' 
    AND column_name = 'final_video_completed_at'
  ) THEN
    ALTER TABLE public.kie_video_generations 
    ADD COLUMN final_video_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add final_video_status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'kie_video_generations' 
    AND column_name = 'final_video_status'
  ) THEN
    ALTER TABLE public.kie_video_generations 
    ADD COLUMN final_video_status TEXT;
  END IF;
END $$;

-- Add final_video_error column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'kie_video_generations' 
    AND column_name = 'final_video_error'
  ) THEN
    ALTER TABLE public.kie_video_generations 
    ADD COLUMN final_video_error TEXT;
  END IF;
END $$;

-- Verify columns were added
DO $$
BEGIN
  PERFORM 1 FROM information_schema.columns 
  WHERE table_schema = 'public' 
  AND table_name = 'kie_video_generations' 
  AND column_name IN ('final_video_completed_at', 'final_video_status', 'final_video_error');
  RAISE NOTICE 'Final video columns verified';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not verify final video columns: %', SQLERRM;
END $$;
