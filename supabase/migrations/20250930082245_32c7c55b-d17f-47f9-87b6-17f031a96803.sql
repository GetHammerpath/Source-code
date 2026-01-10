-- Create new enums for the enhanced form
CREATE TYPE visual_style AS ENUM ('realistic', 'cartoonized');
CREATE TYPE gender_avatar AS ENUM ('male', 'female', 'neutral');
CREATE TYPE aspect_ratio AS ENUM ('16:9', '9:16');
CREATE TYPE render_mode_v2 AS ENUM ('veo3', 'veo3_fast');

-- Add new columns to video_requests table
ALTER TABLE public.video_requests
  ADD COLUMN title TEXT DEFAULT '',
  ADD COLUMN caption TEXT,
  ADD COLUMN story_idea TEXT,
  ADD COLUMN character TEXT,
  ADD COLUMN visual_style visual_style DEFAULT 'realistic',
  ADD COLUMN colors TEXT,
  ADD COLUMN gender_avatar gender_avatar DEFAULT 'neutral',
  ADD COLUMN scenes INTEGER DEFAULT 5,
  ADD COLUMN aspect_ratio aspect_ratio DEFAULT '16:9',
  ADD COLUMN special_request TEXT,
  ADD COLUMN render_mode_v2 render_mode_v2 DEFAULT 'veo3_fast';

-- Migrate existing data from old columns to new columns
UPDATE public.video_requests
SET 
  character = COALESCE(avatar_name, 'Default Character'),
  special_request = notes,
  render_mode_v2 = CASE 
    WHEN render_mode::text = 'fast' THEN 'veo3_fast'::render_mode_v2
    WHEN render_mode::text = 'quality' THEN 'veo3'::render_mode_v2
    ELSE 'veo3_fast'::render_mode_v2
  END;

-- Drop old columns
ALTER TABLE public.video_requests
  DROP COLUMN avatar_name,
  DROP COLUMN avatar_ethnicity,
  DROP COLUMN notes,
  DROP COLUMN render_mode;

-- Rename new render_mode column
ALTER TABLE public.video_requests
  RENAME COLUMN render_mode_v2 TO render_mode;

-- Make required fields NOT NULL (after setting defaults)
ALTER TABLE public.video_requests
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN character SET NOT NULL;