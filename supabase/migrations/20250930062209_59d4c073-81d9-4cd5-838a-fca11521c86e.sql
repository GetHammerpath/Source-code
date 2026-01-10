-- Create storage bucket for jobsite photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('jobsite-photos', 'jobsite-photos', true);

-- Create storage policies for jobsite photos
CREATE POLICY "Anyone can view jobsite photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'jobsite-photos');

CREATE POLICY "Authenticated users can upload jobsite photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'jobsite-photos');

CREATE POLICY "Users can update their own photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'jobsite-photos');

CREATE POLICY "Users can delete their own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'jobsite-photos');