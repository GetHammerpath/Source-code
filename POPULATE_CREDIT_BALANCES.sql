-- Populate credit_balance for existing users
-- Run this after creating the credit_balance table

-- First, check how many users exist
SELECT COUNT(*) as total_users FROM auth.users;

-- Check how many credit balances exist
SELECT COUNT(*) as existing_balances FROM public.credit_balance;

-- Create credit balances for all existing users (starting at 0 credits)
INSERT INTO public.credit_balance (user_id, credits)
SELECT 
  id as user_id,
  0 as credits
FROM auth.users
WHERE id NOT IN (
  SELECT user_id 
  FROM public.credit_balance 
  WHERE user_id IS NOT NULL
)
ON CONFLICT (user_id) DO NOTHING;

-- Verify the balances were created
SELECT 
  COUNT(*) as total_balances,
  SUM(credits) as total_credits
FROM public.credit_balance;

-- Show all credit balances with user emails
SELECT 
  cb.user_id,
  p.email,
  cb.credits,
  cb.updated_at
FROM public.credit_balance cb
LEFT JOIN public.profiles p ON cb.user_id = p.id
ORDER BY cb.updated_at DESC;
