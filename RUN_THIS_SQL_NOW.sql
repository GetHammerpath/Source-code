-- Copy and paste this entire SQL into Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new

-- Create provider_balance_snapshots table
CREATE TABLE IF NOT EXISTS public.provider_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('kie', 'fal')),
  balance_value DECIMAL(20, 2) NOT NULL,
  balance_unit TEXT NOT NULL DEFAULT 'credits',
  fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  raw_response_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(provider, fetched_at)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_provider_balance_snapshots_provider_fetched 
  ON public.provider_balance_snapshots(provider, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_balance_snapshots_created_at 
  ON public.provider_balance_snapshots(created_at DESC);

-- Enable RLS
ALTER TABLE public.provider_balance_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Admins can view provider balance snapshots" ON public.provider_balance_snapshots;

-- RLS Policy: Only admins can view provider balance snapshots
CREATE POLICY "Admins can view provider balance snapshots"
  ON public.provider_balance_snapshots FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Function to get latest balance for a provider
CREATE OR REPLACE FUNCTION get_latest_provider_balance(p_provider TEXT)
RETURNS TABLE (
  balance_value DECIMAL,
  balance_unit TEXT,
  fetched_at TIMESTAMPTZ,
  error_message TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pbs.balance_value,
    pbs.balance_unit,
    pbs.fetched_at,
    pbs.error_message
  FROM public.provider_balance_snapshots pbs
  WHERE pbs.provider = p_provider
  ORDER BY pbs.fetched_at DESC
  LIMIT 1;
END;
$$;
