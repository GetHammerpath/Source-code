-- Repair: Add Studio Access subscription for a user whose subscription wasn't applied by webhook
-- Use when: User paid for Studio Access but Billing still shows "No Studio Access subscription"
--
-- 1. Get your user ID: Supabase Dashboard → Authentication → Users → your email → copy "User UID"
-- 2. Get your Stripe subscription ID: Stripe Dashboard → Customers → [you] → Subscriptions → copy "sub_..."
-- 3. Replace YOUR_USER_ID and sub_XXXXXXXX below, then run in SQL Editor.

INSERT INTO public.subscriptions (
  user_id,
  plan,
  status,
  stripe_subscription_id,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
)
VALUES (
  'YOUR_USER_ID'::uuid,
  'studio_access',
  'active',
  'sub_XXXXXXXX',
  NOW(),
  NOW() + INTERVAL '1 month',
  false,
  NOW(),
  NOW()
)
ON CONFLICT (user_id, status) DO UPDATE SET
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = NOW();
