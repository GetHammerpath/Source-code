-- Set stripe_customer_id = 'cus_Tr4IXamKKjWsX2' for mershard@icloud so sync-subscription queries Stripe correctly.

UPDATE public.profiles
SET stripe_customer_id = 'cus_Tr4IXamKKjWsX2'
WHERE id IN (SELECT id FROM auth.users WHERE email ILIKE '%mershard%' LIMIT 1);
