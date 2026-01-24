# Run Billing Migration - URGENT

## Problem
The `subscriptions` table doesn't exist, causing a 404 error. The migration file exists but hasn't been applied to your database.

## Solution: Run the Migration

### Step 1: Go to Supabase SQL Editor

1. Go to: **https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new**
2. Or: Dashboard → **SQL Editor** → **New Query**

### Step 2: Run First Migration (Create Tables)

1. Open the file: `supabase/migrations/20260122000000_add_billing_tables.sql`
2. Copy the **entire contents** of that file
3. Paste into the Supabase SQL Editor
4. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
5. Wait for it to complete (should take a few seconds)

### Step 3: Run Second Migration (Update to Studio Access Model)

1. Open the file: `supabase/migrations/20260123000000_update_billing_to_usage_model.sql`
2. Copy the **entire contents** of that file
3. Paste into the Supabase SQL Editor (new query or same one)
4. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
5. Wait for it to complete

### Step 4: Verify Tables Were Created

Run this query to verify:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('subscriptions', 'credit_balance', 'credit_transactions', 'video_jobs');
```

You should see all 4 tables in the results.

### Step 5: Try Checkout Again

1. Refresh your app
2. Try checkout again
3. The 404 error should be gone!

## What This Migration Creates

- ✅ `subscriptions` table - for Studio Access subscriptions
- ✅ `credit_balance` table - tracks user credit balances
- ✅ `credit_transactions` table - ledger of all credit transactions
- ✅ `video_jobs` table - tracks credit usage for video generation
- ✅ Adds `stripe_customer_id` column to `profiles` table
- ✅ Sets up RLS policies
- ✅ Creates indexes for performance

## After Running

The checkout should work! The Edge Function will be able to:
- Create/update user profiles with Stripe customer IDs
- Create subscriptions in the database
- Track credit purchases
