-- Set mershard@icloud.com as admin and create test subscription
-- This migration will:
-- 1. Update the user's role to 'admin'
-- 2. Create a test Studio Access subscription (if subscriptions table exists)

DO $$
DECLARE
  target_user_id UUID;
  test_subscription_id UUID;
  now_time TIMESTAMP WITH TIME ZONE;
  period_end TIMESTAMP WITH TIME ZONE;
  user_roles_exists BOOLEAN;
  subscriptions_exists BOOLEAN;
BEGIN
  -- Initialize variables inside BEGIN block
  now_time := NOW();
  period_end := now_time + INTERVAL '1 month';
  test_subscription_id := gen_random_uuid();
  
  -- Find the user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'mershard@icloud.com';

  IF target_user_id IS NULL THEN
    RAISE NOTICE 'User with email mershard@icloud.com not found. Skipping admin setup.';
    RETURN;
  END IF;

  -- Check if user_roles table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_roles'
  ) INTO user_roles_exists;

  IF user_roles_exists THEN
    -- Update user role to admin (insert or update)
    INSERT INTO public.user_roles (user_id, role, created_at)
    VALUES (target_user_id, 'admin', now_time)
    ON CONFLICT (user_id, role) 
    DO UPDATE SET role = 'admin';
    
    RAISE NOTICE 'User % (mershard@icloud.com) has been set as admin', target_user_id;
  ELSE
    RAISE NOTICE 'user_roles table does not exist. Skipping role assignment.';
  END IF;

  -- Check if subscriptions table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'subscriptions'
  ) INTO subscriptions_exists;

  IF subscriptions_exists THEN
    -- Delete any existing Studio Access subscription first
    DELETE FROM public.subscriptions 
    WHERE user_id = target_user_id AND plan = 'studio_access';
    
    -- Create test Studio Access subscription
    INSERT INTO public.subscriptions (
      id,
      user_id,
      plan,
      status,
      stripe_subscription_id,
      stripe_customer_id,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      created_at,
      updated_at
    ) VALUES (
      test_subscription_id,
      target_user_id,
      'studio_access',
      'active',
      'sub_test_admin_' || substr(gen_random_uuid()::text, 1, 24),
      'cus_test_admin_' || substr(gen_random_uuid()::text, 1, 24),
      now_time,
      period_end,
      false,
      now_time,
      now_time
    );
    
    RAISE NOTICE 'Test Studio Access subscription created for user %', target_user_id;
    RAISE NOTICE 'Subscription ID: %, Renewal date: %', test_subscription_id, period_end;
  ELSE
    RAISE NOTICE 'Subscriptions table does not exist. Skipping subscription creation.';
    RAISE NOTICE 'Please run the billing tables migration first (20260122000000_add_billing_tables.sql)';
  END IF;

END $$;
