# Check Edge Function Logs for Exact Error

## Step 1: Check the Logs

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Click on **"create-checkout-session"**
3. Click on the **"Logs"** tab
4. Try checkout again in your app
5. **Look for the most recent error** - it will show the exact error message

## Common Errors You Might See

### "STUDIO_ACCESS_PRICE_ID not configured"
**Fix**: Make sure `STUDIO_ACCESS_PRICE_ID` is set in Supabase secrets

### "STRIPE_SECRET_KEY" error
**Fix**: Make sure `STRIPE_SECRET_KEY` is set

### "SITE_URL" related
**Fix**: Set `SITE_URL` = `https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app`

### "Failed to create profile" or RLS error
**Fix**: The function should now use service role key - make sure you updated the code

### Stripe API error
**Fix**: Check if `STRIPE_SECRET_KEY` is correct and valid

## Step 2: Verify All Secrets Are Set

Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

Check these secrets exist:
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STUDIO_ACCESS_PRICE_ID` 
- ✅ `SITE_URL`
- ✅ `KIE_COST_PER_MINUTE`
- ✅ `CREDIT_MARKUP_MULTIPLIER`
- ✅ `CREDITS_PER_MINUTE`
- ✅ `SUPABASE_URL` (auto-provided)
- ✅ `SUPABASE_ANON_KEY` (auto-provided)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (auto-provided, reserved)

## Step 3: Check Browser Console

1. Open browser console (F12)
2. Go to **Console** tab
3. Try checkout again
4. Look for any additional error messages

## What to Share

Please share:
1. **The exact error message** from the Edge Function logs
2. **Any errors** from the browser console
3. **Which secrets are set** in Supabase

This will help me identify the exact issue!
