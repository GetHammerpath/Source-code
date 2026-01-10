-- Add Sora 2 Pro specific columns to kie_video_generations table
ALTER TABLE kie_video_generations
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS audio_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS resolution VARCHAR(10) DEFAULT '1080p',
ADD COLUMN IF NOT EXISTS sora_model VARCHAR(50);

-- Create index for efficient filtering by model
CREATE INDEX IF NOT EXISTS idx_kie_video_generations_model 
ON kie_video_generations(model);

COMMENT ON COLUMN kie_video_generations.duration IS 'Duration per scene in seconds (7.5, 10, or 15 for Sora)';
COMMENT ON COLUMN kie_video_generations.audio_enabled IS 'Whether synchronized audio generation is enabled for Sora';
COMMENT ON COLUMN kie_video_generations.resolution IS 'Video resolution (1080p for Sora 2 Pro)';
COMMENT ON COLUMN kie_video_generations.sora_model IS 'Specific Sora model variant used';