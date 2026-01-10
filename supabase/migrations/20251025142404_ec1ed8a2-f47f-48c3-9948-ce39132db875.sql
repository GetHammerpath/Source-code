-- Add columns to store Fal.ai status and response URLs
ALTER TABLE kie_video_generations
ADD COLUMN final_video_status_url TEXT,
ADD COLUMN final_video_response_url TEXT;