-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new
-- 1. Find mershard@icloud user and check subscriptions
-- 2. Insert active Studio Access row if missing

DO $$
DECLARE
  uid UUID;
  prof RECORD;
  has_active BOOLEAN;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email ILIKE '%mershard%' LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'No user found for mershard@icloud';
    RETURN;
  END IF;

  SELECT id, email, stripe_customer_id INTO prof FROM public.profiles WHERE id = uid;
  IF NOT FOUND THEN
    RAISE NOTICE 'No profile for user %', uid;
    RETURN;
  END IF;
  RAISE NOTICE 'User: % | % | stripe_customer_id: %', prof.id, prof.email, prof.stripe_customer_id;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = uid AND status IN ('active', 'trialing')
  ) INTO has_active;

  IF has_active THEN
    RAISE NOTICE 'Active subscription already exists.';
    RETURN;
  END IF;

  INSERT INTO public.subscriptions (
    user_id, plan, status, stripe_subscription_id,
    current_period_start, current_period_end, cancel_at_period_end,
    created_at, updated_at
  ) VALUES (
    uid, 'studio_access', 'active', COALESCE('repair_' || uid::text, NULL),
    NOW(), NOW() + INTERVAL '1 month', false,
    NOW(), NOW()
  )
  ON CONFLICT (user_id, status) DO UPDATE SET
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
    current_period_end = GREATEST(subscriptions.current_period_end, EXCLUDED.current_period_end),
    updated_at = NOW();

  RAISE NOTICE 'Repaired: active Studio Access subscription for %', prof.email;
END $$;
