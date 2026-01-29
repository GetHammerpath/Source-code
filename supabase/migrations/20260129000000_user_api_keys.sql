-- User API keys for programmatic access (use credits, call video gen, etc.)
CREATE TABLE public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_api_keys_key_hash ON public.user_api_keys(key_hash);
CREATE INDEX idx_user_api_keys_user_id ON public.user_api_keys(user_id);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys"
  ON public.user_api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys"
  ON public.user_api_keys FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys (e.g. last_used_at)"
  ON public.user_api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
  ON public.user_api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can read by key_hash for API key resolution (used by Edge Functions)
CREATE POLICY "Service role can read api keys by hash"
  ON public.user_api_keys FOR SELECT
  TO service_role
  USING (true);

COMMENT ON TABLE public.user_api_keys IS 'API keys for users to access duidui programmatically (Bearer duidui_xxx).';
