# Debug Checkout Error - Step by Step

## Current Error
"Edge Function returned a non-2xx status code"

This means the function is being called but returning an error (500).

## Step 1: Check Browser Console for Detailed Error

1. Open your app: https://source-code-mauve-psi.vercel.app
2. Open browser console (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Try checkout again
5. **Look for the new detailed error message** - it should now show the actual error from the Edge Function

The improved error handling will show:
- The exact error message from the Edge Function
- Additional details if available

## Step 2: Check Supabase Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Click on **"create-checkout-session"**
3. Click on **"Logs"** tab
4. Try checkout again
5. **Look for the most recent error** - it will show:
   - The exact error message
   - Stack trace
   - Which line failed

## Step 3: Verify Function is Deployed

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Verify **"create-checkout-session"** appears in the list
3. If it's NOT there, deploy it:
   ```bash
   supabase functions deploy create-checkout-session
   ```

## Step 4: Verify All Secrets Are Set

Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

Verify these secrets exist:
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STUDIO_ACCESS_PRICE_ID` (most critical!)
- ✅ `SITE_URL` = `https://source-code-mauve-psi.vercel.app` (your actual URL)
- ✅ `KIE_COST_PER_MINUTE` = `0.20`
- ✅ `CREDIT_MARKUP_MULTIPLIER` = `3`
- ✅ `CREDITS_PER_MINUTE` = `1`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` (if you added it manually)

## Step 5: Common Issues After Secrets Are Set

### Issue: Function needs redeployment
**Fix**: After setting secrets, the function should automatically pick them up, but if errors persist:
```bash
supabase functions deploy create-checkout-session
```

### Issue: Wrong SITE_URL
**Fix**: Make sure `SITE_URL` matches your actual Vercel URL:
- Current: `https://source-code-mauve-psi.vercel.app`
- Not: `https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app`

### Issue: Invalid STUDIO_ACCESS_PRICE_ID
**Fix**: 
1. Go to Stripe Dashboard → Products
2. Find your "Studio Access" product
3. Verify the Price ID is correct (starts with `price_...`)
4. Make sure it's a recurring monthly price set to $99

### Issue: Stripe API error
**Fix**: 
1. Verify `STRIPE_SECRET_KEY` is correct
2. Make sure you're using the right key (live vs test)
3. Check Stripe Dashboard for any API errors

## What to Share

Please share:
1. **The exact error message** from the browser console (after trying checkout)
2. **The error from Edge Function logs** in Supabase
3. **Which secrets are currently set** in Supabase

This will help identify the exact issue!
