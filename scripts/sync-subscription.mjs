#!/usr/bin/env node
/**
 * Run sync-subscription Edge Function for a user.
 * Usage: node --env-file=.env scripts/sync-subscription.mjs
 * Env: TEST_USER_EMAIL, TEST_USER_PASSWORD, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}
if (!email || !password) {
  console.error('Missing TEST_USER_EMAIL or TEST_USER_PASSWORD. Set in .env.');
  process.exit(1);
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, anon);

  const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signErr || !signIn?.session) {
    console.error('Sign-in failed:', signErr?.message ?? 'No session');
    process.exit(1);
  }

  const res = await fetch(`${url}/functions/v1/sync-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signIn.session.access_token}`,
      apikey: anon,
    },
  });

  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    console.error('Response not JSON:', raw.slice(0, 300));
    process.exit(1);
  }

  if (!res.ok) {
    console.error('Sync failed:', res.status, data?.error ?? raw);
    process.exit(1);
  }

  if (data?.synced) {
    console.log('OK – Subscription synced from Stripe.');
  } else {
    console.log('Sync complete (no change):', data?.reason ?? data);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
