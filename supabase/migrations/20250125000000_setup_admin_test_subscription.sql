-- Set mershard@icloud.com as admin and create test subscription
-- This migration will:
-- 1. Update the user's role to 'admin'
-- 2. Create a test Studio Access subscription

DO $$
DECLARE
  target_user_id UUID;
  test_subscription_id UUID := gen_random_uuid();
  current_time TIMESTAMP WITH TIME ZONE := NOW();
  period_end TIMESTAMP WITH TIME ZONE := current_time + INTERVAL '1 month';
BEGIN
  -- Find the user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = 'mershard@icloud.com';

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email mershard@icloud.com not found';
  END IF;

  -- Update user role to admin (insert or update)
  INSERT INTO public.user_roles (user_id, role, created_at)
  VALUES (target_user_id, 'admin', current_time)
  ON CONFLICT (user_id, role) 
  DO UPDATE SET role = 'admin';

  -- Create test Studio Access subscription
  -- Delete any existing subscription first (to handle unique constraint)
  DELETE FROM public.subscriptions 
  WHERE user_id = target_user_id;
  
  -- Now create the test subscription
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
      'sub_test_admin_' || substr(gen_random_uuid()::text, 1, 24), -- Test subscription ID
      'cus_test_admin_' || substr(gen_random_uuid()::text, 1, 24), -- Test customer ID
      current_time,
      period_end,
      false,
      current_time,
      current_time
    );
    
    RAISE NOTICE 'Admin user setup complete for mershard@icloud.com';
    RAISE NOTICE 'Test subscription created: %', test_subscription_id;
  ELSE
    RAISE NOTICE 'User already has a Studio Access subscription. Skipping subscription creation.';
  END IF;

  RAISE NOTICE 'User ID: %', target_user_id;
  RAISE NOTICE 'Admin role assigned successfully';

END $$;
