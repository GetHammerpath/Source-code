-- Ensure kie_video_generations table exists with all required columns
-- This fixes "Failed to create generation record" errors

CREATE TABLE IF NOT EXISTS public.kie_video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- User Input
  image_url TEXT NOT NULL,
  industry TEXT NOT NULL,
  avatar_name TEXT NOT NULL,
  city TEXT NOT NULL,
  story_idea TEXT,
  
  -- AI Generated
  ai_prompt TEXT,
  
  -- Kie.ai Initial Generation (8 seconds)
  initial_task_id TEXT,
  initial_status TEXT DEFAULT 'pending',
  initial_video_url TEXT,
  initial_error TEXT,
  initial_completed_at TIMESTAMPTZ,
  
  -- Kie.ai Extended Generation
  extended_task_id TEXT,
  extended_status TEXT DEFAULT 'pending',
  extended_video_url TEXT,
  extended_error TEXT,
  extended_completed_at TIMESTAMPTZ,
  
  -- Settings
  model TEXT DEFAULT 'veo3_fast',
  aspect_ratio TEXT DEFAULT '16:9',
  watermark TEXT,
  seeds INTEGER,
  
  -- Multi-scene support
  number_of_scenes INTEGER DEFAULT 1,
  scene_prompts JSONB DEFAULT '[]'::jsonb,
  current_scene INTEGER DEFAULT 1,
  is_multi_scene BOOLEAN DEFAULT FALSE,
  
  -- Sora 2 Pro specific
  duration INTEGER DEFAULT 10,
  audio_enabled BOOLEAN DEFAULT true,
  resolution VARCHAR(10) DEFAULT '1080p',
  sora_model VARCHAR(50),
  
  -- Video segments and stitching
  video_segments JSONB DEFAULT '[]'::jsonb,
  is_final BOOLEAN DEFAULT false,
  final_video_url TEXT,
  
  -- Script/dialogue
  script TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  metadata JSONB
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_kie_generations_user_id ON public.kie_video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_kie_generations_created_at ON public.kie_video_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kie_video_generations_multi_scene ON public.kie_video_generations(is_multi_scene) WHERE is_multi_scene = TRUE;
CREATE INDEX IF NOT EXISTS idx_kie_video_generations_model ON public.kie_video_generations(model);

-- Enable RLS
ALTER TABLE public.kie_video_generations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'kie_video_generations'
    AND policyname = 'Users can view own video generations'
  ) THEN
    CREATE POLICY "Users can view own video generations"
      ON public.kie_video_generations FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'kie_video_generations'
    AND policyname = 'Users can create own video generations'
  ) THEN
    CREATE POLICY "Users can create own video generations"
      ON public.kie_video_generations FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'kie_video_generations'
    AND policyname = 'Users can update own video generations'
  ) THEN
    CREATE POLICY "Users can update own video generations"
      ON public.kie_video_generations FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'kie_video_generations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kie_video_generations;
  END IF;
END $$;

-- Verify table is accessible
DO $$
BEGIN
  PERFORM 1 FROM public.kie_video_generations LIMIT 1;
  RAISE NOTICE 'kie_video_generations table verified and accessible';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not verify kie_video_generations table: %', SQLERRM;
END $$;
