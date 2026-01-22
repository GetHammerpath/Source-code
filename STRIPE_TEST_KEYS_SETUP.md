# Stripe Test Keys Setup

## Problem
You're using **LIVE Stripe keys** (`sk_live_...`), so test cards don't work.

## Solution: Use Test Keys for Development

### Step 1: Get Your Test Keys from Stripe

1. Go to: https://dashboard.stripe.com/test/apikeys
2. You'll see:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

### Step 2: Update Supabase Secrets

Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

**Update these secrets:**
- `STRIPE_SECRET_KEY` = `sk_test_...` (your test secret key)

### Step 3: Create Test Price ID

1. Go to: https://dashboard.stripe.com/test/products
2. Create a product: "Studio Access"
3. Create a price: $99/month (recurring)
4. Copy the **Price ID** (starts with `price_...`)
5. Update Supabase secret:
   - `STUDIO_ACCESS_PRICE_ID` = `price_...` (your test price ID)

### Step 4: Test Cards That Work

With test keys, use these cards:

**Success:**
- `4242 4242 4242 4242` - Visa
- `5555 5555 5555 4444` - Mastercard
- Any future expiry date (e.g., 12/25)
- Any CVC (e.g., 123)

**Declined:**
- `4000 0000 0000 0002` - Card declined
- `4000 0000 0000 9995` - Insufficient funds

**3D Secure:**
- `4000 0027 6000 3184` - Requires authentication

### Step 5: Test Webhook Locally (Optional)

For local webhook testing:
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Run: `stripe listen --forward-to https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/stripe-webhook`
3. Copy the webhook signing secret
4. Update `STRIPE_WEBHOOK_SECRET` in Supabase

## Important Notes

### When to Use Test vs Live

- **Test Keys**: Development, testing, staging
- **Live Keys**: Production only

### Switching Between Test and Live

You can have both:
- Test keys in Supabase secrets (for development)
- Live keys documented separately (for production)

Just update the secrets when switching environments.

## Quick Test Checklist

- [ ] `STRIPE_SECRET_KEY` = `sk_test_...`
- [ ] `STUDIO_ACCESS_PRICE_ID` = `price_...` (test price)
- [ ] `STRIPE_WEBHOOK_SECRET` = `whsec_...` (test webhook secret)
- [ ] Try checkout with test card `4242 4242 4242 4242`

## If Test Card Still Doesn't Work

1. **Verify you're using test keys** (check Supabase secrets)
2. **Check Stripe Dashboard** → Payments → Look for the attempt
3. **Check Edge Function logs** for errors
4. **Verify price ID** is a test price (not live)
