-- Make request_id nullable in jobsite_photos to allow uploads before request creation
ALTER TABLE public.jobsite_photos 
ALTER COLUMN request_id DROP NOT NULL;

-- Add RLS policy to allow authenticated users to upload photos without a request_id
CREATE POLICY "Authenticated users can upload photos without request"
ON public.jobsite_photos
FOR INSERT
TO authenticated
WITH CHECK (request_id IS NULL AND auth.uid() IS NOT NULL);

-- Add RLS policy to allow users to view their own unassigned photos
CREATE POLICY "Users can view their own unassigned photos"
ON public.jobsite_photos
FOR SELECT
TO authenticated
USING (request_id IS NULL);