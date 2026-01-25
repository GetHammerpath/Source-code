-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new
-- ALREADY APPLIED via migration 20260125063753_set_stripe_customer_id_mershard.sql
-- Sets stripe_customer_id = 'cus_Tr4IXamKKjWsX2' for mershard@icloud so sync-subscription queries Stripe for that customer.

DO $$
DECLARE
  uid UUID;
  prof RECORD;
  updated_count INT;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email ILIKE '%mershard%' LIMIT 1;
  IF uid IS NULL THEN
    RAISE NOTICE 'No user found for mershard@icloud';
    RETURN;
  END IF;

  SELECT id, email, stripe_customer_id INTO prof FROM public.profiles WHERE id = uid;
  IF NOT FOUND THEN
    RAISE NOTICE 'No profile for user %. Create one first.', uid;
    RETURN;
  END IF;

  RAISE NOTICE 'Before: user % | % | stripe_customer_id: %', prof.id, prof.email, prof.stripe_customer_id;

  UPDATE public.profiles
  SET stripe_customer_id = 'cus_Tr4IXamKKjWsX2'
  WHERE id = uid;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % row(s). stripe_customer_id is now cus_Tr4IXamKKjWsX2 for %', updated_count, prof.email;

  RAISE NOTICE 'Next: go to Billing and click "Refresh subscription status" to sync from Stripe.';
END $$;
