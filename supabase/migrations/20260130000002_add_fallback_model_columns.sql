-- Phase 4: Add fallback model support for automatic retry on failure
-- This migration adds columns to track fallback model usage

-- Add fallback_model column to kie_video_generations
ALTER TABLE public.kie_video_generations
ADD COLUMN IF NOT EXISTS fallback_model TEXT DEFAULT NULL;

-- Add retry_count to track how many fallback attempts
ALTER TABLE public.kie_video_generations
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add original_model to track what model was originally requested
ALTER TABLE public.kie_video_generations
ADD COLUMN IF NOT EXISTS original_model TEXT DEFAULT NULL;

-- Add fallback_reason to track why fallback was triggered
ALTER TABLE public.kie_video_generations
ADD COLUMN IF NOT EXISTS fallback_reason TEXT DEFAULT NULL;

-- Comment the columns
COMMENT ON COLUMN public.kie_video_generations.fallback_model IS 'Model to use if primary model fails (Phase 4)';
COMMENT ON COLUMN public.kie_video_generations.retry_count IS 'Number of fallback retry attempts';
COMMENT ON COLUMN public.kie_video_generations.original_model IS 'Originally requested model before any fallbacks';
COMMENT ON COLUMN public.kie_video_generations.fallback_reason IS 'Reason for triggering fallback (e.g., content_policy, rate_limit, api_error)';

-- Create index for finding generations that used fallback
CREATE INDEX IF NOT EXISTS idx_kie_video_generations_fallback 
ON public.kie_video_generations(original_model) 
WHERE original_model IS NOT NULL;
