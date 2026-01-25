-- Admin System Tables Migration
-- Creates tables for admin controls, audit logging, provider settings, and user limits

-- 1. Login Events Table (track login history)
CREATE TABLE IF NOT EXISTS public.login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_login_events_user_id ON public.login_events(user_id);
CREATE INDEX idx_login_events_created_at ON public.login_events(created_at DESC);
CREATE INDEX idx_login_events_success ON public.login_events(success);

-- Enable RLS
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own login events, admins can view all
CREATE POLICY "Users can view own login events"
  ON public.login_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all login events"
  ON public.login_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 2. User Status and Limits Table
CREATE TABLE IF NOT EXISTS public.user_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  daily_credit_cap INTEGER DEFAULT NULL CHECK (daily_credit_cap IS NULL OR daily_credit_cap > 0),
  max_job_minutes DECIMAL(10, 2) DEFAULT NULL CHECK (max_job_minutes IS NULL OR max_job_minutes > 0),
  max_concurrent_jobs INTEGER DEFAULT NULL CHECK (max_concurrent_jobs IS NULL OR max_concurrent_jobs > 0),
  retry_limit_per_job INTEGER DEFAULT NULL CHECK (retry_limit_per_job IS NULL OR retry_limit_per_job >= 0),
  provider_allowlist TEXT[] DEFAULT NULL, -- Array of allowed providers: ['kie', 'fal', etc.]
  suspended_reason TEXT,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create default user_limits for existing users
INSERT INTO public.user_limits (user_id, status)
SELECT id, 'active'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.user_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own limits, admins can manage all
CREATE POLICY "Users can view own limits"
  ON public.user_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all limits"
  ON public.user_limits FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Trigger to create user_limits for new users
CREATE OR REPLACE FUNCTION ensure_user_limits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_limits (user_id, status)
  VALUES (NEW.id, 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_user_limits ON auth.users;
CREATE TRIGGER on_auth_user_created_user_limits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION ensure_user_limits();

-- 3. Provider Settings Table (global and per-user)
CREATE TABLE IF NOT EXISTS public.provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('kie', 'fal', 'runway', 'sora')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = global setting
  enabled BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 3 CHECK (max_retries >= 0),
  timeout_seconds INTEGER DEFAULT 300 CHECK (timeout_seconds > 0),
  max_duration_per_job INTEGER DEFAULT 300 CHECK (max_duration_per_job > 0), -- seconds
  concurrency_limit INTEGER DEFAULT 5 CHECK (concurrency_limit > 0),
  emergency_pause BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(provider, user_id)
);

-- Create default global provider settings
INSERT INTO public.provider_settings (provider, user_id, enabled)
VALUES
  ('kie', NULL, true),
  ('fal', NULL, true),
  ('runway', NULL, true),
  ('sora', NULL, true)
ON CONFLICT (provider, user_id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can view settings, only admins can modify
CREATE POLICY "Anyone can view provider settings"
  ON public.provider_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage provider settings"
  ON public.provider_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 4. Stripe Event Log Table
CREATE TABLE IF NOT EXISTS public.stripe_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_stripe_event_log_stripe_event_id ON public.stripe_event_log(stripe_event_id);
CREATE INDEX idx_stripe_event_log_processed_at ON public.stripe_event_log(processed_at DESC);
CREATE INDEX idx_stripe_event_log_status ON public.stripe_event_log(status);
CREATE INDEX idx_stripe_event_log_event_type ON public.stripe_event_log(event_type);

-- Enable RLS
ALTER TABLE public.stripe_event_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view Stripe event logs
CREATE POLICY "Admins can view Stripe event logs"
  ON public.stripe_event_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 5. Audit Log Table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action_type TEXT NOT NULL, -- 'credit_adjustment', 'user_suspend', 'role_change', 'provider_toggle', etc.
  target_type TEXT NOT NULL, -- 'user', 'provider', 'credits', 'subscription', etc.
  target_id UUID, -- ID of the target resource
  before_json JSONB,
  after_json JSONB,
  reason TEXT NOT NULL, -- Required reason for the action
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_admin_user_id);
CREATE INDEX idx_audit_log_target ON public.audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_action ON public.audit_log(action_type);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- 6. Add columns to profiles table if missing
DO $$ 
BEGIN
  -- Add email_verified column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email_verified BOOLEAN DEFAULT false;
  END IF;

  -- Add last_login column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'last_login'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_login TIMESTAMPTZ;
  END IF;
END $$;

-- 7. Add columns to video_jobs table if missing (only when table exists; created later by add_billing_tables)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video_jobs') THEN
    RETURN;
  END IF;

  -- Add error_code and error_message columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_jobs' 
    AND column_name = 'error_code'
  ) THEN
    ALTER TABLE public.video_jobs ADD COLUMN error_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_jobs' 
    AND column_name = 'error_message'
  ) THEN
    ALTER TABLE public.video_jobs ADD COLUMN error_message TEXT;
  END IF;

  -- Add retry_count column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_jobs' 
    AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE public.video_jobs ADD COLUMN retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0);
  END IF;

  -- Add started_at column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'video_jobs' 
    AND column_name = 'started_at'
  ) THEN
    ALTER TABLE public.video_jobs ADD COLUMN started_at TIMESTAMPTZ;
  END IF;
END $$;

-- 8. Function to log login events (to be called from auth hooks)
CREATE OR REPLACE FUNCTION log_login_event(
  p_user_id UUID,
  p_ip_address TEXT,
  p_user_agent TEXT,
  p_success BOOLEAN,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_id UUID;
BEGIN
  INSERT INTO public.login_events (
    user_id,
    ip_address,
    user_agent,
    success,
    failure_reason
  ) VALUES (
    p_user_id,
    p_ip_address,
    p_user_agent,
    p_success,
    p_failure_reason
  ) RETURNING id INTO event_id;

  -- Update last_login on successful login
  IF p_success THEN
    UPDATE public.profiles
    SET last_login = NOW()
    WHERE id = p_user_id;
  END IF;

  RETURN event_id;
END;
$$;

-- 9. Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log(
  p_actor_admin_user_id UUID,
  p_action_type TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_before_json JSONB,
  p_after_json JSONB,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  -- Verify actor is admin
  IF NOT has_role(p_actor_admin_user_id, 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can create audit logs';
  END IF;

  INSERT INTO public.audit_log (
    actor_admin_user_id,
    action_type,
    target_type,
    target_id,
    before_json,
    after_json,
    reason
  ) VALUES (
    p_actor_admin_user_id,
    p_action_type,
    p_target_type,
    p_target_id,
    p_before_json,
    p_after_json,
    p_reason
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- 10. Update trigger for user_limits updated_at
CREATE TRIGGER update_user_limits_updated_at
  BEFORE UPDATE ON public.user_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. Update trigger for provider_settings updated_at
CREATE TRIGGER update_provider_settings_updated_at
  BEFORE UPDATE ON public.provider_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
