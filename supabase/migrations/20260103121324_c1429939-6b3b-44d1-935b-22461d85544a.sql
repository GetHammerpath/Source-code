-- Make base_image_url nullable for text-only mode
ALTER TABLE bulk_video_batches 
ALTER COLUMN base_image_url DROP NOT NULL;

-- Add generation_type column
ALTER TABLE bulk_video_batches 
ADD COLUMN generation_type TEXT DEFAULT 'REFERENCE_2_VIDEO';