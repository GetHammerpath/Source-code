# Fix: credit_balance Table Missing

## Error
"Could not find the table 'public.credit_balance' in the schema cache"

## Solution: Run the Billing Tables Migration

The `credit_balance` table needs to be created. Run this migration:

### Step 1: Go to Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new
2. Or: Dashboard → SQL Editor → New Query

### Step 2: Run the Migration

Copy and paste the **entire content** from:
`supabase/migrations/20260122000000_add_billing_tables.sql`

Or run this SQL directly:

```sql
-- Create credit_balance table (one row per user)
CREATE TABLE IF NOT EXISTS public.credit_balance (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure balance never goes negative (enforced by check constraint)
  CONSTRAINT non_negative_credits CHECK (credits >= 0)
);

-- Create credit_transactions table (ledger)
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'purchase', 'grant', 'debit', 'refund', 'adjustment'
  amount INTEGER NOT NULL, -- Positive for grants/purchases, negative for debits/refunds
  balance_after INTEGER NOT NULL, -- Credits after this transaction
  stripe_event_id TEXT, -- For idempotency
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  metadata JSONB, -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_event_id ON public.credit_transactions(stripe_event_id) WHERE stripe_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.credit_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_balance
CREATE POLICY IF NOT EXISTS "Users can view own credit balance"
  ON public.credit_balance FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for credit_transactions
CREATE POLICY IF NOT EXISTS "Users can view own credit transactions"
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
```

### Step 3: Execute

1. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
2. You should see a success message

### Step 4: Verify

Run this to verify the table exists:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('credit_balance', 'credit_transactions');
```

You should see both tables listed.

### Step 5: Create Credit Balances for Existing Users

If you have existing users, create credit balances for them:

```sql
INSERT INTO public.credit_balance (user_id, credits)
SELECT id, 0
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.credit_balance)
ON CONFLICT (user_id) DO NOTHING;
```

## After Running Migration

1. Refresh the admin credits page
2. The error should be gone
3. You should see credit balances (all starting at 0 for existing users)

## Full Migration

If you want to run the complete billing migration (recommended), use the full file:
- `supabase/migrations/20260122000000_add_billing_tables.sql`

This will create all billing-related tables including:
- `subscriptions`
- `credit_balance`
- `credit_transactions`
- `video_jobs`
