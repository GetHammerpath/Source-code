# Stripe Test Account — End-to-End Test (No Real Charges)

Use **Stripe Test Mode** to run checkout (Studio Access + credit purchases) with fake cards. No real money is charged.

---

## 1. Use Stripe Test Mode

1. Open **[Stripe Dashboard](https://dashboard.stripe.com)**.
2. Turn **Test mode** ON (toggle top-right). The UI will show **"Test mode"** when it’s on.
3. All steps below use **test** data (test keys, test products, test webhooks).

---

## 2. Get Test API Keys

1. Go to **[API Keys (Test)](https://dashboard.stripe.com/test/apikeys)**.
2. Copy:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...` (click “Reveal”).

You’ll use these in Step 4 and 5.

---

## 3. Create Test Products & Prices

### Studio Access (subscription)

1. Go to **[Products (Test)](https://dashboard.stripe.com/test/products)** → **Add product**.
2. **Name**: `Studio Access` (or same as prod).
3. **Pricing**:
   - **One time** → No. Use **Recurring**.
   - **Monthly**.
   - **Price**: `99` USD (or match your prod).
4. **Save**. Copy the **Price ID** (`price_...`). This is your **test** `STUDIO_ACCESS_PRICE_ID`.

### Credits (one-time)

Credits use **dynamic** `price_data` in `create-checkout-session`. No product/price needed in Stripe for credits—only for Studio Access.

---

## 4. Configure Supabase Secrets (Test)

1. Open **Supabase** → your project → **Settings** → **Edge Functions** → **Secrets**  
   (or: `https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions`).
2. Set **test** values:

   | Secret | Value |
   |--------|--------|
   | `STRIPE_SECRET_KEY` | `sk_test_...` |
   | `STUDIO_ACCESS_PRICE_ID` | `price_...` (from Step 3) |
   | `STRIPE_WEBHOOK_SECRET` | From Step 5 (test webhook) |

3. Leave `SERVICE_ROLE_KEY`, `SITE_URL`, etc. as-is. Only Stripe-related secrets switch to test.

---

## 5. Add a Test Webhook (So Credits / Subscriptions Apply)

You need a **test** webhook that points at your `stripe-webhook` Edge Function.

### Option A: Webhook in Stripe Dashboard (simple for deployed app)

1. **[Developers → Webhooks (Test)](https://dashboard.stripe.com/test/webhooks)** → **Add endpoint**.
2. **Endpoint URL**:  
   `https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/stripe-webhook`  
   (replace with your Supabase project URL if different.)
3. **Events to send**:  
   - `checkout.session.completed`  
   - `customer.subscription.created`  
   - `customer.subscription.updated`  
   - `customer.subscription.deleted`  
   - `invoice.paid`  
   - `invoice.payment_failed`  
   Or **“Select events”** and add these.
4. **Add endpoint**. Open the new webhook → **Reveal** signing secret.
5. Copy the **Signing secret** (`whsec_...`). Put it in Supabase as `STRIPE_WEBHOOK_SECRET` (Step 4).

### Option B: Stripe CLI (local webhook testing)

1. Install [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. `stripe login`
3. `stripe listen --forward-to https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/stripe-webhook`
4. CLI prints a **webhook signing secret** (`whsec_...`). Use that as `STRIPE_WEBHOOK_SECRET` in Supabase **while the CLI is running**.

Use **either** A or B, not both at once, for the same endpoint.

---

## 6. Frontend / Vercel (Optional)

If your app uses `VITE_STRIPE_PUBLISHABLE_KEY` (e.g. for Stripe.js):

1. **Vercel** → your project → **Settings** → **Environment Variables**.
2. Set `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_test_...` for the **Preview** (and optionally **Development**) environment.
3. Redeploy so preview/dev use the test publishable key.

Checkout **redirects** to Stripe Hosted Checkout; the session is created with `STRIPE_SECRET_KEY`. The publishable key is only needed if you use Stripe.js on the frontend.

---

## 7. Run a Test Checkout

1. **Use test mode**: Ensure Stripe Dashboard is in **Test mode** and Supabase secrets use **test** keys and **test** `STUDIO_ACCESS_PRICE_ID`.
2. Open your site (e.g. `https://source-code.vercel.app` or your preview URL).
3. **Sign up / log in** with any email (e.g. `test@example.com`). This is your “test account.”
4. Go to **Pricing** or **Billing & Credits** → **Buy Credits** or **Subscribe to Studio Access**.
5. On Stripe Checkout, use **test cards**:

   | Scenario | Card number |
   |----------|-------------|
   | Success | `4242 4242 4242 4242` |
   | Success | `5555 5555 5555 4444` |
   | Decline | `4000 0000 0000 0002` |
   | Insufficient funds | `4000 0000 0000 9995` |

   - **Expiry**: any future date (e.g. `12/34`).
   - **CVC**: any 3 digits (e.g. `123`).
   - **ZIP**: any 5 digits (e.g. `12345`).

6. Complete payment. You should:
   - Be redirected to `/checkout/success`.
   - See the subscription under **Billing** (Studio Access) or credits in **Billing & Credits** (credit purchase).
   - See `checkout.session.completed` (and related) events in **Stripe Dashboard → Developers → Webhooks** and in **Admin → Billing** (Stripe Event Log).

---

## 8. Verify

- **Stripe Dashboard (Test)**: [Payments](https://dashboard.stripe.com/test/payments), [Customers](https://dashboard.stripe.com/test/customers), [Subscriptions](https://dashboard.stripe.com/test/subscriptions).
- **Your app**: Billing page, credit balance, video generation (uses credits).
- **Supabase**: Edge Function logs for `create-checkout-session` and `stripe-webhook`; `credit_balance`, `credit_transactions`, `subscriptions` if you use them.

---

## 9. Switching Back to Live

When you’re done testing:

1. Stripe Dashboard → turn **Test mode** OFF.
2. Supabase secrets: set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` back to **live** values.
3. Set `STUDIO_ACCESS_PRICE_ID` to your **live** Studio Access price.
4. If you changed `VITE_STRIPE_PUBLISHABLE_KEY`, set it back to `pk_live_...` for production.
5. Redeploy if you use env vars in the frontend.

---

## Quick Checklist

- [ ] Stripe in **Test mode**
- [ ] `STRIPE_SECRET_KEY` = `sk_test_...` in Supabase
- [ ] `STUDIO_ACCESS_PRICE_ID` = test `price_...` in Supabase
- [ ] Test webhook added (Dashboard or CLI), `STRIPE_WEBHOOK_SECRET` = `whsec_...` in Supabase
- [ ] Test user: sign up → Pricing/Billing → Checkout → card `4242 4242 4242 4242`
- [ ] Check `/checkout/success`, Billing, and Stripe Dashboard (test)

---

**Summary:** Use Stripe **test** keys, a **test** Studio Access price, and a **test** webhook. Point everything at your real app + Edge Functions. Run checkout as a normal user with `4242 4242 4242 4242`. No real charges.
