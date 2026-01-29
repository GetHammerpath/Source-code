-- Add API access permission to user_limits (admins can revoke/grant API key access)
ALTER TABLE public.user_limits
  ADD COLUMN IF NOT EXISTS api_access_allowed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_limits.api_access_allowed IS 'When false, user cannot authenticate with API keys (duidui_xxx).';
