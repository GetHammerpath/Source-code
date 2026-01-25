# Checkout setup – do these steps

Use this checklist so **Subscribe** and **Buy Credits** work end‑to‑end.

---

## 1. Vercel env vars (deployed app)

**Link:** [Vercel Dashboard](https://vercel.com) → your project → **Settings** → **Environment Variables**

Add or update:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://wzpswnuteisyxxwlnqrn.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your **anon** key (JWT from [Supabase API](https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/api) → anon public) |

Then **redeploy** (Deployments → … → Redeploy, or push a commit).

---

## 2. Supabase Edge Function secrets

**Link:** [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions)

Confirm these exist (we’ve set them before; re‑check if something fails):

| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret (`sk_test_...` or `sk_live_...`) |
| `SERVICE_ROLE_KEY` | [Supabase service role key](https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/api) |
| `STUDIO_ACCESS_PRICE_ID` | Stripe Price ID (e.g. `price_...`) for $99/mo Studio Access |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `SITE_URL` | Your app URL (e.g. `https://source-code.vercel.app`) – optional, we use Origin fallback |

---

## 3. Billing migrations (DB)

**Link:** [Supabase SQL Editor](https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/sql/new)

Run these **in order**, each as a separate run:

1. Open **`supabase/migrations/20260122000000_add_billing_tables.sql`** → copy all → paste in SQL Editor → **Run**.
2. Open **`supabase/migrations/20260123000000_update_billing_to_usage_model.sql`** → copy all → paste in SQL Editor → **Run**.

This creates `subscriptions`, `credit_balance`, `credit_transactions`, `profiles.stripe_customer_id`, etc.  
If you already ran them, you may see “already exists” errors; that’s fine.

---

## 4. Stripe webhook (test mode)

**Link:** [Stripe Webhooks (test)](https://dashboard.stripe.com/test/webhooks)

- **Endpoint URL:** `https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/stripe-webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- **Signing secret** → set as `STRIPE_WEBHOOK_SECRET` in Supabase secrets (step 2).

---

## 5. Verify

1. **Health check (no auth):**  
   [https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/create-checkout-session](https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/create-checkout-session)  
   Expect: `{"ok":true,"env":{"stripe":true,"serviceRole":true,"priceId":true,"siteUrl":true}}`

2. **Checkout:** Log in → Billing & Credits → **Subscribe** or **Buy Credits** → use test card `4242 4242 4242 4242`.

---

## 6. If it still fails

- **Exact error:** The checkout alert shows the Edge Function error; use that to debug.
- **Logs:** [create-checkout-session logs](https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions/create-checkout-session/logs)
- **Troubleshooting:** See **`CHECKOUT_TROUBLESHOOT.md`**
