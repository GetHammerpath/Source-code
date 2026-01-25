# Checkout Troubleshooting

If **Subscribe** or **Buy Credits** fails with "Failed to start checkout", use these steps.

---

## 1. See the actual error

The Checkout page now shows the **exact** error from the Edge Function. Read the alert message—it often says what’s wrong (e.g. missing secret, Stripe error).

---

## 2. Verify Edge Function config

Open this URL in a new tab (no auth needed):

```
https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/create-checkout-session
```

You should get JSON like:

```json
{
  "ok": true,
  "env": { "stripe": true, "serviceRole": true, "priceId": true, "siteUrl": true },
  "hint": "..." 
}
```

- If any of `stripe`, `serviceRole`, `priceId` is `false`, that secret is missing.
- `hint` appears when something is missing and tells you what to set.

**If you get `401 Invalid JWT`:** The Edge Function uses `verify_jwt = false`; the gateway should not require auth for GET. If you still see 401, check Supabase Dashboard → Edge Functions → create-checkout-session → Settings.

---

## 3. Required Supabase secrets

In **Supabase Dashboard** → your project → **Settings** → **Edge Functions** → **Secrets**, set:

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `SERVICE_ROLE_KEY` | Supabase **service role** key (Settings → API) |
| `STUDIO_ACCESS_PRICE_ID` | Stripe Price ID for $99/mo Studio Access |
| `SITE_URL` | Your app URL (e.g. `https://source-code.vercel.app`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) for credits/subscriptions |

Use **test** keys and **test** Price ID for testing; **live** for production.

---

## 4. Required Vercel env vars

In **Vercel** → your project → **Settings** → **Environment Variables**:

| Name | Description |
|------|-------------|
| `VITE_SUPABASE_URL` | `https://wzpswnuteisyxxwlnqrn.supabase.co` (or your project URL) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **anon** key (long JWT from Dashboard → API → anon public; not a placeholder like `sb_publishable_...`) |

Redeploy after changing env vars.

---

## 5. Check Edge Function logs

**Supabase Dashboard** → **Edge Functions** → **create-checkout-session** → **Logs**

Look for the error message when you click "Continue to Payment". It will show missing secrets, Stripe errors, or DB errors.

---

## 6. Common errors

| Error | Fix |
|-------|-----|
| `Missing required... STRIPE_SECRET_KEY` | Set `STRIPE_SECRET_KEY` in Supabase secrets |
| `SERVICE_ROLE_KEY not configured` | Set `SERVICE_ROLE_KEY` (service role key from Supabase API settings) |
| `STUDIO_ACCESS_PRICE_ID not configured` | Create $99/mo price in Stripe, add Price ID as `STUDIO_ACCESS_PRICE_ID` |
| `No authorization header` / `Unauthorized` | You must be logged in. Sign in, then try checkout again |
| `Failed to create profile` | Run billing migrations; ensure `profiles` exists and has `stripe_customer_id` |
| Stripe API error in message | Check Stripe Dashboard (test/live). Invalid price ID, key, or account issue |

---

## 7. Redeploy after changing secrets

Secrets are read at runtime. No need to redeploy the Edge Function when you only change secrets.

Redeploy the **frontend** (e.g. push to Git / Vercel) if you change **Vercel** env vars (`VITE_*`).
