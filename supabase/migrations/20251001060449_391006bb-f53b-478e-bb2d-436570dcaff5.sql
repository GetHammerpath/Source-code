-- Update RLS policies for video_requests to implement role-based access
-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Users can view all video requests" ON video_requests;

-- Users can only view their own video requests
CREATE POLICY "Users can view their own video requests"
ON video_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admins and managers can view all video requests
CREATE POLICY "Admins and managers can view all video requests"
ON video_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'manager'::user_role));