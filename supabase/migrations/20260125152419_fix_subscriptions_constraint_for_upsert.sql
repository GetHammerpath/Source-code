-- Fix subscriptions constraint to be non-deferrable so ON CONFLICT works
-- PostgreSQL doesn't allow deferrable constraints in ON CONFLICT clauses

-- Drop the old deferrable constraint
ALTER TABLE public.subscriptions 
  DROP CONSTRAINT IF EXISTS one_active_subscription;

-- Recreate as non-deferrable (required for ON CONFLICT in upserts)
ALTER TABLE public.subscriptions 
  ADD CONSTRAINT one_active_subscription 
  UNIQUE (user_id, status);
