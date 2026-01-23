-- Debug: Check your credit balance and transactions

-- 1. Check your user ID and email
SELECT id, email FROM auth.users WHERE email = 'mershard@icloud.com';

-- 2. Check your credit balance
SELECT 
  cb.user_id,
  cb.credits,
  cb.updated_at,
  p.email
FROM public.credit_balance cb
LEFT JOIN public.profiles p ON cb.user_id = p.id
WHERE p.email = 'mershard@icloud.com';

-- 3. Check all credit transactions for your account
SELECT 
  ct.id,
  ct.type,
  ct.amount,
  ct.balance_after,
  ct.metadata,
  ct.created_at,
  p.email
FROM public.credit_transactions ct
LEFT JOIN public.profiles p ON ct.user_id = p.id
WHERE p.email = 'mershard@icloud.com'
ORDER BY ct.created_at DESC;

-- 4. Check Stripe webhook events (to see if credit purchases were processed)
SELECT 
  sel.id,
  sel.event_type,
  sel.status,
  sel.processed_at,
  sel.error_message
FROM public.stripe_event_log sel
WHERE sel.event_type IN ('checkout.session.completed', 'payment_intent.succeeded')
ORDER BY sel.processed_at DESC
LIMIT 20;

-- 5. Check all credit balances (admin view)
SELECT 
  cb.user_id,
  p.email,
  cb.credits,
  cb.updated_at
FROM public.credit_balance cb
LEFT JOIN public.profiles p ON cb.user_id = p.id
ORDER BY cb.credits DESC;
