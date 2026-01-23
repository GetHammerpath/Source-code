-- Create credit_balance table (one row per user)
CREATE TABLE IF NOT EXISTS public.credit_balance (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  CONSTRAINT non_negative_credits CHECK (credits >= 0)
);

-- Create credit_transactions table (ledger)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  stripe_event_id TEXT,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own credit balance" ON public.credit_balance;
DROP POLICY IF EXISTS "Users can view own credit transactions" ON public.credit_transactions;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_event_id ON public.credit_transactions(stripe_event_id) WHERE stripe_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.credit_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (must drop first, then create)
CREATE POLICY "Users can view own credit balance"
  ON public.credit_balance FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

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

-- Create credit balances for existing users
INSERT INTO public.credit_balance (user_id, credits)
SELECT id, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.credit_balance WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;
