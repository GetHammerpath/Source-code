# Quick Fix: Create Provider Balance Table

The CLI approach is blocked by a syntax error in another migration. Here's the fastest way:

## Option 1: Run in Supabase Dashboard (Fastest - 30 seconds)

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new
2. Copy this SQL:

```sql
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

CREATE INDEX IF NOT EXISTS idx_provider_balance_snapshots_provider_fetched 
  ON public.provider_balance_snapshots(provider, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_balance_snapshots_created_at 
  ON public.provider_balance_snapshots(created_at DESC);

ALTER TABLE public.provider_balance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view provider balance snapshots" ON public.provider_balance_snapshots;

CREATE POLICY "Admins can view provider balance snapshots"
  ON public.provider_balance_snapshots FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));
```

3. Paste and click "Run"
4. Done!

## Option 2: Fix the Broken Migration First

The migration `20250125000000_setup_admin_test_subscription.sql` has a syntax error. Once that's fixed, you can use `supabase db push`.

But for now, **Option 1 is fastest** - just run the SQL in the dashboard!
