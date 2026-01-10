-- Create junction table for request photo selections
CREATE TABLE public.request_selected_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.video_requests(id) ON DELETE CASCADE,
  photo_id UUID NOT NULL REFERENCES public.jobsite_photos(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(request_id, photo_id)
);

-- Enable RLS
ALTER TABLE public.request_selected_photos ENABLE ROW LEVEL SECURITY;

-- Users can view selections for their own requests
CREATE POLICY "Users can view their own request photo selections"
ON public.request_selected_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.video_requests
    WHERE video_requests.id = request_selected_photos.request_id
    AND video_requests.user_id = auth.uid()
  )
);

-- Admins and managers can view all selections
CREATE POLICY "Admins and managers can view all photo selections"
ON public.request_selected_photos
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'manager'::user_role)
);

-- Users can manage selections for their own requests
CREATE POLICY "Users can manage their own request photo selections"
ON public.request_selected_photos
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.video_requests
    WHERE video_requests.id = request_selected_photos.request_id
    AND video_requests.user_id = auth.uid()
  )
);

-- Admins and managers can manage all selections
CREATE POLICY "Admins and managers can manage all photo selections"
ON public.request_selected_photos
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'manager'::user_role)
);

-- Update jobsite_photos RLS to allow all authenticated users to view photos
CREATE POLICY "All authenticated users can view photos"
ON public.jobsite_photos
FOR SELECT
TO authenticated
USING (true);