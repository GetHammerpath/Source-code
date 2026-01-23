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

-- RLS Policy
CREATE POLICY "Admins can view provider balance snapshots"
  ON public.provider_balance_snapshots FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
