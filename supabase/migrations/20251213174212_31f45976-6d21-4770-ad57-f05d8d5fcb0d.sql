-- Create runway_extend_generations table for the new Runway Extend feature
CREATE TABLE public.runway_extend_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  avatar_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  city TEXT NOT NULL,
  story_idea TEXT,
  
  -- Scene configuration
  number_of_scenes INTEGER DEFAULT 1,
  current_scene INTEGER DEFAULT 1,
  scene_prompts JSONB DEFAULT '[]'::jsonb,
  duration_per_scene INTEGER DEFAULT 10,
  aspect_ratio TEXT DEFAULT '16:9',
  resolution TEXT DEFAULT '720p',
  
  -- Scene 1 (Initial Generation)
  initial_task_id TEXT,
  initial_video_url TEXT,
  initial_status TEXT DEFAULT 'pending',
  initial_error TEXT,
  initial_completed_at TIMESTAMPTZ,
  
  -- Current Extension
  extended_task_id TEXT,
  extended_video_url TEXT,
  extended_status TEXT DEFAULT 'pending',
  extended_error TEXT,
  extended_completed_at TIMESTAMPTZ,
  
  -- Video segments tracking
  video_segments JSONB DEFAULT '[]'::jsonb,
  
  -- Final stitched video
  final_video_url TEXT,
  final_video_status TEXT DEFAULT 'pending',
  final_video_error TEXT,
  final_video_completed_at TIMESTAMPTZ,
  
  -- Avatar identity for consistency
  avatar_identity_prefix TEXT,
  image_analysis JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.runway_extend_generations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own runway extend generations"
  ON public.runway_extend_generations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own runway extend generations"
  ON public.runway_extend_generations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own runway extend generations"
  ON public.runway_extend_generations
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_runway_extend_generations_updated_at
  BEFORE UPDATE ON public.runway_extend_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for the table
ALTER PUBLICATION supabase_realtime ADD TABLE public.runway_extend_generations;