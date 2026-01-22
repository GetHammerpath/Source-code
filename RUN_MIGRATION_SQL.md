# Run Migration to Add stripe_customer_id Column

## Problem
The `profiles` table is missing the `stripe_customer_id` column.

## Solution: Run the Migration

### Step 1: Go to Supabase SQL Editor

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new
2. Or: Dashboard → SQL Editor → New Query

### Step 2: Run This SQL

Copy and paste this SQL into the editor:

```sql
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
    RAISE NOTICE 'Added stripe_customer_id column to profiles table';
  ELSE
    RAISE NOTICE 'stripe_customer_id column already exists';
  END IF;
END $$;
```

### Step 3: Execute

1. Click **"Run"** or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)
2. You should see a success message

### Step 4: Verify

Run this to verify the column exists:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'profiles' 
AND column_name = 'stripe_customer_id';
```

You should see `stripe_customer_id` in the results.

## After Running Migration

1. Try checkout again
2. The error should be gone
3. The function will be able to create/update profiles with `stripe_customer_id`

## Alternative: Run Full Migration

If you want to run the complete billing migration (recommended):

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new
2. Copy the entire content from: `supabase/migrations/20260122000000_add_billing_tables.sql`
3. Paste and run it

This will create all billing tables and add the `stripe_customer_id` column.
