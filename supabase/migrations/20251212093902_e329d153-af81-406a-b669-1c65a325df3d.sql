-- Add avatar_identity_prefix column to store consistent avatar description for all scenes
ALTER TABLE public.kie_video_generations 
ADD COLUMN IF NOT EXISTS avatar_identity_prefix text;