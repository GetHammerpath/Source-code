-- Migration: Add billing, subscriptions, and credits tables
-- Created: 2026-01-22

-- Create subscription plan enum
CREATE TYPE subscription_plan AS ENUM ('starter', 'pro', 'studio');

-- Create subscription status enum
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'unpaid', 'trialing');

-- Create credit transaction type enum
CREATE TYPE credit_transaction_type AS ENUM ('purchase', 'grant', 'debit', 'refund');

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL,
  status subscription_status NOT NULL DEFAULT 'active',
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure one active subscription per user
  -- Note: Non-deferrable required for ON CONFLICT in upserts
  CONSTRAINT one_active_subscription UNIQUE (user_id, status)
);

-- Create credit_balance table (one row per user)
CREATE TABLE public.credit_balance (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure balance never goes negative (enforced by check constraint)
  CONSTRAINT non_negative_credits CHECK (credits >= 0)
);

-- Create credit_transactions table (ledger)
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type credit_transaction_type NOT NULL,
  amount INTEGER NOT NULL, -- Positive for grants/purchases, negative for debits/refunds
  balance_after INTEGER NOT NULL, -- Credits after this transaction
  stripe_event_id TEXT, -- For idempotency
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  metadata JSONB, -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create video_jobs table (track credit usage)
CREATE TABLE public.video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id UUID REFERENCES public.kie_video_generations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- 'kie', 'fal', etc.
  estimated_minutes DECIMAL(10, 2),
  actual_minutes DECIMAL(10, 2),
  estimated_credits INTEGER,
  credits_charged INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'refunded'
  credits_reserved INTEGER DEFAULT 0, -- Reserved but not yet charged
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_stripe_event_id ON public.credit_transactions(stripe_event_id) WHERE stripe_event_id IS NOT NULL;
CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);
CREATE INDEX idx_video_jobs_user_id ON public.video_jobs(user_id);
CREATE INDEX idx_video_jobs_generation_id ON public.video_jobs(generation_id);
CREATE INDEX idx_video_jobs_status ON public.video_jobs(status);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for credit_balance
CREATE POLICY "Users can view own credit balance"
  ON public.credit_balance FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for credit_transactions
CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for video_jobs
CREATE POLICY "Users can view own video jobs"
  ON public.video_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own video jobs"
  ON public.video_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add stripe_customer_id to profiles table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN stripe_customer_id TEXT UNIQUE;
  END IF;
END $$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for subscriptions updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for credit_balance updated_at
CREATE TRIGGER update_credit_balance_updated_at
  BEFORE UPDATE ON public.credit_balance
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure credit balance exists when user is created
CREATE OR REPLACE FUNCTION ensure_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.credit_balance (user_id, credits)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create credit balance for new users
DROP TRIGGER IF EXISTS on_auth_user_created_credit_balance ON auth.users;
CREATE TRIGGER on_auth_user_created_credit_balance
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_credit_balance();
