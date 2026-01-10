-- Add generation_mode column to bulk_video_batches table
-- This distinguishes between 'all_combinations' (original bulk video) and 'smart_selection' (new smart bulk)
ALTER TABLE bulk_video_batches 
ADD COLUMN IF NOT EXISTS generation_mode TEXT DEFAULT 'all_combinations';

-- Add a comment for clarity
COMMENT ON COLUMN bulk_video_batches.generation_mode IS 'Type of generation: all_combinations (original) or smart_selection (new smart bulk)';