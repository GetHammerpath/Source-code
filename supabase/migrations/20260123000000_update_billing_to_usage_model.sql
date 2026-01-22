-- Migration: Update billing to usage-based model (Studio Access + Minutes)
-- Created: 2026-01-23

-- Update subscriptions table for Studio Access (single subscription model)
ALTER TABLE public.subscriptions 
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Change plan column to just track Studio Access
-- We'll use 'studio_access' as the only plan type
ALTER TABLE public.subscriptions 
  ALTER COLUMN plan TYPE TEXT;

-- Update plan constraint to only allow 'studio_access'
ALTER TABLE public.subscriptions 
  ADD CONSTRAINT subscriptions_plan_check 
  CHECK (plan = 'studio_access');

-- Add columns for add-ons
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS seat_quantity INTEGER DEFAULT 3 CHECK (seat_quantity >= 3),
  ADD COLUMN IF NOT EXISTS advanced_compliance_enabled BOOLEAN DEFAULT false;

-- Rename credit_balance to minute_balance (keeping credits internally, but label as minutes)
-- We'll use a view/alias for the UI, but keep the table name for backward compatibility
-- Just update the comment for clarity
COMMENT ON TABLE public.credit_balance IS 'User minute balance (stored as credits internally: 1 credit = 1 minute)';
COMMENT ON COLUMN public.credit_balance.credits IS 'Minutes available (stored as credits: 1 credit = 1 minute)';

-- Rename credit_transactions comments
COMMENT ON TABLE public.credit_transactions IS 'Minute transaction ledger (stored as credits internally: 1 credit = 1 minute)';
COMMENT ON COLUMN public.credit_transactions.amount IS 'Minutes (positive for purchases, negative for usage) - stored as credits internally';
COMMENT ON COLUMN public.credit_transactions.balance_after IS 'Minutes after transaction - stored as credits internally';

-- Add minute-specific transaction type
ALTER TYPE credit_transaction_type ADD VALUE IF NOT EXISTS 'adjustment';

-- Create auto_top_up_settings table
CREATE TABLE IF NOT EXISTS public.auto_top_up_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  threshold_minutes INTEGER DEFAULT 50 CHECK (threshold_minutes >= 0),
  purchase_minutes INTEGER DEFAULT 500 CHECK (purchase_minutes > 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS for auto_top_up_settings
ALTER TABLE public.auto_top_up_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy for auto_top_up_settings
CREATE POLICY "Users can view own auto top-up settings"
  ON public.auto_top_up_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own auto top-up settings"
  ON public.auto_top_up_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auto top-up settings"
  ON public.auto_top_up_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update video_jobs comments for minutes
COMMENT ON TABLE public.video_jobs IS 'Video generation jobs with minute tracking';
COMMENT ON COLUMN public.video_jobs.estimated_minutes IS 'Estimated rendered minutes';
COMMENT ON COLUMN public.video_jobs.actual_minutes IS 'Actual rendered minutes';
COMMENT ON COLUMN public.video_jobs.estimated_credits IS 'Estimated minutes to charge (stored as credits: 1 credit = 1 minute)';
COMMENT ON COLUMN public.video_jobs.credits_charged IS 'Minutes charged (stored as credits: 1 credit = 1 minute)';
COMMENT ON COLUMN public.video_jobs.credits_reserved IS 'Minutes reserved (stored as credits: 1 credit = 1 minute)';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auto_top_up_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto_top_up_settings updated_at
DROP TRIGGER IF EXISTS update_auto_top_up_updated_at_trigger ON public.auto_top_up_settings;
CREATE TRIGGER update_auto_top_up_updated_at_trigger
  BEFORE UPDATE ON public.auto_top_up_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_top_up_updated_at();
