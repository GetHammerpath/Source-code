# Test Stripe Checkout After Deployment

## ✅ Function Deployed!

Now let's verify everything works.

## Step 1: Verify Function is Deployed

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Confirm `create-checkout-session` appears in the list
3. Click on it to see it's active

## Step 2: Verify Secrets Are Set

Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

Make sure these secrets are set:
- ✅ `STRIPE_SECRET_KEY`
- ✅ `STUDIO_ACCESS_PRICE_ID` (most important!)
- ✅ `SITE_URL` = `https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app`
- ✅ `KIE_COST_PER_MINUTE` = `0.20`
- ✅ `CREDIT_MARKUP_MULTIPLIER` = `3`
- ✅ `CREDITS_PER_MINUTE` = `1`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`

## Step 3: Test Checkout

1. Go to your app: https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app
2. Make sure you're **logged in**
3. Go to `/checkout?mode=access` or click "Subscribe to Studio Access"
4. Click "Continue to Payment"
5. You should be redirected to Stripe checkout

## Step 4: Check for Errors

If checkout still fails:
1. Open browser console (F12)
2. Look for error messages
3. Check Supabase Edge Function logs:
   - **Supabase Dashboard** → **Functions** → **create-checkout-session** → **Logs**

## Also Deploy These Functions (Later)

For full billing functionality, also deploy:
- `create-portal-session` (for Stripe Customer Portal)
- `stripe-webhook` (for processing payment webhooks)

But test checkout first to make sure the main function works!

## Success Indicators

✅ No "Failed to send request" error
✅ Redirects to Stripe checkout page
✅ Shows correct price ($99/month for Studio Access)
✅ Can complete or cancel checkout

Let me know if checkout works or if you see any errors!
