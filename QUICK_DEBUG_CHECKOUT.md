# Quick Debug: Checkout Error

## Step 1: Open Browser Console (MOST IMPORTANT!)

1. **Open your app**: https://source-code-p3jisk2ut-jon-brinkleys-projects.vercel.app/checkout?mode=access
2. **Press F12** (or Cmd+Option+I on Mac) to open Developer Tools
3. **Click the "Console" tab**
4. **Try checkout again** (click "Continue to Payment")
5. **Look for error messages** - you should now see detailed error information

The console will show:
- The exact error message from the Edge Function
- Full error details
- The response object

## Step 2: Check Supabase Edge Function Logs

1. Go to: **https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions**
2. Click on **"create-checkout-session"**
3. Click on **"Logs"** tab
4. **Try checkout again** in your app
5. **Look at the most recent log entry** - it will show:
   - The exact error message
   - Stack trace
   - Which line failed

## Step 3: Verify Function is Deployed

1. Go to: **https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions**
2. **Verify "create-checkout-session" appears in the list**
3. If it's NOT there, deploy it:
   ```bash
   supabase functions deploy create-checkout-session
   ```

## Step 4: Common Errors & Fixes

### Error: "STUDIO_ACCESS_PRICE_ID not configured"
**Fix**: 
1. Go to Stripe Dashboard → Products
2. Create "Studio Access" product with $99/month recurring price
3. Copy the Price ID (starts with `price_...`)
4. Add to Supabase secrets: **Settings → Functions → Secrets** → Add `STUDIO_ACCESS_PRICE_ID`

### Error: "SUPABASE_SERVICE_ROLE_KEY" related
**Fix**: 
1. Go to Supabase Dashboard → **Settings → API**
2. Copy the **Service role key** (not the anon key)
3. Go to **Settings → Functions → Secrets**
4. Add `SUPABASE_SERVICE_ROLE_KEY` with the service role key value

### Error: "STRIPE_SECRET_KEY" related
**Fix**: Verify `STRIPE_SECRET_KEY` is set in Supabase secrets

### Error: "SITE_URL" related
**Fix**: Set `SITE_URL` = `https://source-code-p3jisk2ut-jon-brinkleys-projects.vercel.app` in Supabase secrets

### Error: "Unauthorized" or "No authorization header"
**Fix**: Make sure you're logged in before trying checkout

## What to Share

Please share:
1. **The exact error message from the browser console** (after Step 1)
2. **The error from Edge Function logs** (after Step 2)
3. **Which secrets are currently set** in Supabase

This will help identify the exact issue!
