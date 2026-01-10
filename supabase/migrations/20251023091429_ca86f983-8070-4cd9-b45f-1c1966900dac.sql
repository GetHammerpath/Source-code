-- Add new columns to kie_video_generations table for multi-part video extension and stitching
ALTER TABLE kie_video_generations 
ADD COLUMN IF NOT EXISTS video_segments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS final_video_url TEXT,
ADD COLUMN IF NOT EXISTS final_video_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS final_video_task_id TEXT,
ADD COLUMN IF NOT EXISTS final_video_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS final_video_error TEXT;

COMMENT ON COLUMN kie_video_generations.video_segments IS 'Array of video segments with url, timestamp, duration, and type';
COMMENT ON COLUMN kie_video_generations.is_final IS 'Whether user has finished extending and wants to stitch';
COMMENT ON COLUMN kie_video_generations.final_video_url IS 'URL of final stitched video from Fal.ai';