-- Add multi-scene support columns to kie_video_generations table
ALTER TABLE kie_video_generations 
ADD COLUMN IF NOT EXISTS number_of_scenes INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS scene_prompts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS current_scene INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_multi_scene BOOLEAN DEFAULT FALSE;

-- Add index for faster querying of multi-scene generations
CREATE INDEX IF NOT EXISTS idx_kie_video_generations_multi_scene ON kie_video_generations(is_multi_scene) WHERE is_multi_scene = TRUE;