#!/usr/bin/env node
/**
 * Test create-checkout-session Edge Function with a real user.
 * Usage:
 *   node --env-file=.env scripts/test-checkout.mjs
 *   # or set env: TEST_USER_EMAIL, TEST_USER_PASSWORD, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
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
  console.error('Missing TEST_USER_EMAIL or TEST_USER_PASSWORD. Set in .env or env.');
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

  const res = await fetch(`${url}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${signIn.session.access_token}`,
      apikey: anon,
    },
    body: JSON.stringify({ mode: 'subscription', planId: 'studio_access' }),
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
    console.error('Checkout failed:', res.status, data?.error ?? raw);
    process.exit(1);
  }

  if (data?.error) {
    console.error('Error in body:', data.error);
    process.exit(1);
  }
  if (!data?.url) {
    console.error('No checkout URL in response:', data);
    process.exit(1);
  }

  console.log('OK – Checkout URL:', data.url);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
