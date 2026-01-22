# Fix Stripe Checkout Error

## Error
"Failed to start checkout. Please try again."

## Root Cause
The Supabase Edge Function `create-checkout-session` is missing required environment variables (secrets).

## Solution: Set Supabase Edge Function Secrets

Go to **Supabase Dashboard** → Your Project → **Edge Functions** → **Secrets**

Add these secrets (if not already set):

### Required Secrets:

1. **STRIPE_SECRET_KEY**
   ```
   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
   ```

2. **STUDIO_ACCESS_PRICE_ID** (CRITICAL - This is likely missing!)
   - Go to **Stripe Dashboard** → **Products**
   - Find or create "Studio Access" product
   - Create a $99/month recurring price
   - Copy the **Price ID** (starts with `price_...`)
   - Add it as secret: `STUDIO_ACCESS_PRICE_ID`

3. **SITE_URL**
   ```
   https://your-vercel-app.vercel.app
   ```
   (Replace with your actual Vercel URL)

4. **KIE_COST_PER_MINUTE**
   ```
   0.20
   ```

5. **CREDIT_MARKUP_MULTIPLIER**
   ```
   3
   ```

6. **CREDITS_PER_MINUTE**
   ```
   1
   ```

7. **SUPABASE_URL** (should already be set)
   ```
   https://wzpswnuteisyxxwlnqrn.supabase.co
   ```

8. **SUPABASE_ANON_KEY** (should already be set)
   ```
   sb_publishable_Rvk6d-mQaD7LN-FjXZjwXg_nc5HIHJ_
   ```

## Step-by-Step: Create Studio Access Price in Stripe

If you don't have `STUDIO_ACCESS_PRICE_ID` yet:

1. Go to **Stripe Dashboard** → **Products**
2. Click **"+ Add product"**
3. Fill in:
   - **Name**: `Studio Access`
   - **Description**: `Monthly subscription for studio access`
   - **Pricing model**: `Standard pricing`
   - **Price**: `$99.00`
   - **Billing period**: `Monthly`
4. Click **"Save product"**
5. Copy the **Price ID** (starts with `price_...`)
6. Add it to Supabase Edge Function secrets as `STUDIO_ACCESS_PRICE_ID`

## Verify Secrets Are Set

1. Go to **Supabase Dashboard** → **Edge Functions** → **Secrets**
2. Verify all secrets above are listed
3. Make sure there are no typos

## Test After Setting Secrets

1. Go to your deployed app
2. Try the checkout flow again
3. Check browser console (F12) for any error messages
4. Check Supabase Edge Function logs:
   - **Supabase Dashboard** → **Edge Functions** → **create-checkout-session** → **Logs**

## Common Issues

### Issue: "STUDIO_ACCESS_PRICE_ID not configured"
**Fix**: Create the price in Stripe and add it as a secret

### Issue: "Unauthorized" error
**Fix**: Make sure `SUPABASE_ANON_KEY` is set correctly

### Issue: "Invalid customer" error
**Fix**: Make sure `STRIPE_SECRET_KEY` is set correctly

### Issue: Success URL redirects to wrong place
**Fix**: Update `SITE_URL` to your actual Vercel URL

## Quick Checklist

- [ ] `STRIPE_SECRET_KEY` is set in Supabase secrets
- [ ] `STUDIO_ACCESS_PRICE_ID` is set (create in Stripe first!)
- [ ] `SITE_URL` is set to your Vercel URL
- [ ] `KIE_COST_PER_MINUTE`, `CREDIT_MARKUP_MULTIPLIER`, `CREDITS_PER_MINUTE` are set
- [ ] `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
- [ ] Test checkout flow

## Most Likely Issue

**Missing `STUDIO_ACCESS_PRICE_ID`** - This is the #1 cause of checkout failures. Create the price in Stripe first, then add it as a secret.
