-- Create table for Kie.ai video generations
CREATE TABLE kie_video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User Input
  image_url TEXT NOT NULL,
  industry TEXT NOT NULL,
  avatar_name TEXT NOT NULL,
  city TEXT NOT NULL,
  
  -- AI Generated
  ai_prompt TEXT,
  
  -- Kie.ai Initial Generation (8 seconds)
  initial_task_id TEXT,
  initial_status TEXT DEFAULT 'pending',
  initial_video_url TEXT,
  initial_error TEXT,
  
  -- Kie.ai Extended Generation
  extended_task_id TEXT,
  extended_status TEXT DEFAULT 'pending',
  extended_video_url TEXT,
  extended_error TEXT,
  
  -- Settings
  model TEXT DEFAULT 'veo3_fast',
  aspect_ratio TEXT DEFAULT '16:9',
  watermark TEXT,
  seeds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  initial_completed_at TIMESTAMPTZ,
  extended_completed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB
);

-- Enable RLS
ALTER TABLE kie_video_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own video generations"
  ON kie_video_generations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own video generations"
  ON kie_video_generations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video generations"
  ON kie_video_generations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_kie_generations_user_id ON kie_video_generations(user_id);
CREATE INDEX idx_kie_generations_created_at ON kie_video_generations(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE kie_video_generations;