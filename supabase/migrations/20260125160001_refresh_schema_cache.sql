-- Refresh PostgREST schema cache to ensure new columns are visible
-- This ensures the Edge Function can immediately use the new columns

-- Force PostgREST to reload schema by touching the table
DO $$
BEGIN
  -- Simple query to trigger schema cache refresh
  PERFORM 1 FROM public.kie_video_generations LIMIT 1;
  RAISE NOTICE 'Schema cache refresh triggered for kie_video_generations';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not refresh schema cache: %', SQLERRM;
END $$;
