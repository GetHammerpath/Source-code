# Debug Stripe Checkout Error

## Steps to Debug

### 1. Check Browser Console

1. Open your app: https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app
2. Open browser console (F12 or Cmd+Option+I)
3. Go to the **Console** tab
4. Try the checkout flow again
5. Look for error messages - they will now show more details

### 2. Check Supabase Edge Function Logs

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Click on **"create-checkout-session"**
3. Click on **"Logs"** tab
4. Try checkout again
5. Check the logs for errors

### 3. Verify All Secrets Are Set

Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

Verify these secrets exist:

- ✅ `STRIPE_SECRET_KEY`
- ⚠️ `STUDIO_ACCESS_PRICE_ID` (MOST LIKELY MISSING!)
- ✅ `SITE_URL` = `https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app`
- ✅ `KIE_COST_PER_MINUTE` = `0.20`
- ✅ `CREDIT_MARKUP_MULTIPLIER` = `3`
- ✅ `CREDITS_PER_MINUTE` = `1`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`

### 4. Common Error Messages

#### "STUDIO_ACCESS_PRICE_ID not configured"
**Fix**: Create the price in Stripe and add it as a secret

#### "Unauthorized" or "No authorization header"
**Fix**: Make sure you're logged in before trying checkout

#### "Profile not found"
**Fix**: User profile might not exist. Check Supabase `profiles` table

#### "Invalid mode or missing planId/credits"
**Fix**: Check the request body being sent

## Most Likely Issue

**Missing `STUDIO_ACCESS_PRICE_ID`** - This is the #1 cause.

### How to Create It:

1. **Stripe Dashboard** → **Products** → **"+ Add product"**
2. **Name**: `Studio Access`
3. **Price**: `$99.00` / **Monthly** (recurring)
4. **Save** → Copy the **Price ID** (starts with `price_...`)
5. **Supabase** → **Edge Functions** → **Secrets** → Add `STUDIO_ACCESS_PRICE_ID`

## After Fixing

1. Try checkout again
2. Check browser console for detailed error messages
3. Check Supabase Edge Function logs
4. The error message will now tell you exactly what's wrong
