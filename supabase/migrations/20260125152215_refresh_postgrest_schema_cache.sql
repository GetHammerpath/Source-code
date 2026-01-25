-- Refresh PostgREST schema cache by ensuring subscriptions table exists
-- This migration creates the table if it's missing (shouldn't happen, but fixes the error)

-- Create subscriptions table if it doesn't exist (using final structure from 20260123 migration)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan = 'studio_access'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid', 'trialing')),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  seat_quantity INTEGER DEFAULT 3 CHECK (seat_quantity >= 3),
  advanced_compliance_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure one active subscription per user
  -- Note: Non-deferrable required for ON CONFLICT in upserts
  CONSTRAINT one_active_subscription UNIQUE (user_id, status)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create RLS policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'subscriptions'
    AND policyname = 'Users can view own subscriptions'
  ) THEN
    CREATE POLICY "Users can view own subscriptions"
      ON public.subscriptions FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Verify table is accessible
DO $$
BEGIN
  PERFORM 1 FROM public.subscriptions LIMIT 1;
  RAISE NOTICE 'subscriptions table verified and accessible';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not verify subscriptions table: %', SQLERRM;
END $$;
