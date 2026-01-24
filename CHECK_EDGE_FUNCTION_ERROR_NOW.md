# Check Edge Function Error - Step by Step

## The Error You're Seeing

The console shows: "Edge Function returned a non-2xx status code" with a 500 error.

This means the function is being called but returning an error. The **actual error message** is in the Supabase Edge Function logs.

## Step 1: Check Edge Function Logs (MOST IMPORTANT!)

1. **Go to Supabase Dashboard:**
   https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions

2. **Click on "create-checkout-session"**

3. **Click on the "Logs" tab**

4. **Try checkout again** in your app (click "Continue to Payment")

5. **Look at the most recent log entry** - it will show:
   - The exact error message
   - Which line failed
   - Stack trace
   - The actual error from the function

## Step 2: Common Errors You Might See

### Error: "Missing required environment variables: SUPABASE_SERVICE_ROLE_KEY"
**Fix:**
1. Go to Supabase Dashboard → **Settings → API**
2. Copy the **Service role key** (the long key, not the anon key)
3. Go to **Settings → Functions → Secrets**
4. Add secret: `SUPABASE_SERVICE_ROLE_KEY` with the service role key value

### Error: "STUDIO_ACCESS_PRICE_ID not configured"
**Fix:**
1. Go to Stripe Dashboard → **Products**
2. Click **"+ Add product"**
3. Create:
   - Name: `Studio Access`
   - Price: `$99.00`
   - Billing: `Monthly` (recurring)
4. Click **"Save product"**
5. Copy the **Price ID** (starts with `price_...`)
6. Go to Supabase → **Settings → Functions → Secrets**
7. Add secret: `STUDIO_ACCESS_PRICE_ID` with the Price ID

### Error: "STRIPE_SECRET_KEY not configured"
**Fix:**
1. Go to Stripe Dashboard → **Developers → API keys**
2. Copy your **Secret key** (starts with `sk_...`)
3. Go to Supabase → **Settings → Functions → Secrets**
4. Add secret: `STRIPE_SECRET_KEY` with your Stripe secret key

### Error: "Failed to create profile" or database error
**Fix:** This usually means `SUPABASE_SERVICE_ROLE_KEY` is missing or incorrect

## Step 3: Verify All Secrets Are Set

Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

Check these secrets exist:
- [ ] `STRIPE_SECRET_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ⚠️ (Most likely missing!)
- [ ] `STUDIO_ACCESS_PRICE_ID`
- [ ] `SITE_URL` = `https://source-code-frvoqyntw-jon-brinkleys-projects.vercel.app`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `KIE_COST_PER_MINUTE` = `0.20`
- [ ] `CREDIT_MARKUP_MULTIPLIER` = `3`
- [ ] `CREDITS_PER_MINUTE` = `1`

## Step 4: After Fixing Secrets

1. **The function automatically picks up new secrets** - no redeploy needed
2. **Try checkout again**
3. **Check the logs again** if it still fails

## What to Share

Please share:
1. **The exact error message from the Edge Function logs** (Step 1)
2. **Which secrets are currently set** in Supabase

This will help identify the exact issue!
