# Debug Edge Function Error

## Error
"Edge Function returned a non-2xx status code"

This means the function is deployed and being called, but it's returning an error (likely 500).

## Step 1: Check Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Click on **"create-checkout-session"**
3. Click on the **"Logs"** tab
4. Try checkout again in your app
5. **Look for the error message** in the logs - it will tell you exactly what's wrong

## Common Errors and Fixes

### Error: "STUDIO_ACCESS_PRICE_ID not configured"
**Fix**: 
1. Go to Stripe Dashboard → Products
2. Create "Studio Access" product with $99/month price
3. Copy the Price ID (starts with `price_...`)
4. Add to Supabase secrets as `STUDIO_ACCESS_PRICE_ID`

### Error: "Profile not found"
**Fix**: Make sure you have a profile in the `profiles` table. The function creates a Stripe customer from your profile.

### Error: "Unauthorized" or "No authorization header"
**Fix**: Make sure you're logged in before trying checkout.

### Error: "STRIPE_SECRET_KEY" related
**Fix**: Verify `STRIPE_SECRET_KEY` is set in Supabase Edge Function secrets.

### Error: "SITE_URL" related
**Fix**: Set `SITE_URL` = `https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app` in Supabase secrets.

## Step 2: Verify All Secrets

Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

Verify these secrets exist:
- ✅ `STRIPE_SECRET_KEY`
- ⚠️ `STUDIO_ACCESS_PRICE_ID` (MOST LIKELY MISSING!)
- ✅ `SITE_URL`
- ✅ `KIE_COST_PER_MINUTE`
- ✅ `CREDIT_MARKUP_MULTIPLIER`
- ✅ `CREDITS_PER_MINUTE`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`

## Step 3: Check Browser Console

1. Open browser console (F12)
2. Go to **Console** tab
3. Try checkout again
4. Look for more detailed error messages

## Most Likely Issue

**Missing `STUDIO_ACCESS_PRICE_ID`** - The function is probably throwing this error.

Check the Edge Function logs to see the exact error message!
