# Update SITE_URL Secret

## Your Vercel URL
```
https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app
```

## Steps to Update SITE_URL in Supabase

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

2. Find the **SITE_URL** secret (or click "Add Secret" if it doesn't exist)

3. Set the value to:
   ```
   https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app
   ```

4. Click **"Save"**

## Also Verify These Secrets Are Set

Make sure these are all set in Supabase Edge Function secrets:

- ✅ **SITE_URL**: `https://source-code-oi1wkfmin-jon-brinkleys-projects.vercel.app`
- ✅ **STRIPE_SECRET_KEY**: (Set in Supabase Dashboard → Settings → Functions → Secrets)
  - ⚠️ **DO NOT commit this key to git!**
  - Get it from: Stripe Dashboard → Developers → API keys
- ⚠️ **STUDIO_ACCESS_PRICE_ID**: Create in Stripe first, then add here
- ✅ **KIE_COST_PER_MINUTE**: `0.20`
- ✅ **CREDIT_MARKUP_MULTIPLIER**: `3`
- ✅ **CREDITS_PER_MINUTE**: `1`
- ✅ **SUPABASE_URL**: `https://wzpswnuteisyxxwlnqrn.supabase.co`
- ✅ **SUPABASE_ANON_KEY**: `sb_publishable_Rvk6d-mQaD7LN-FjXZjwXg_nc5HIHJ_`

## Most Important: Create STUDIO_ACCESS_PRICE_ID

If checkout still fails, you need to create the Studio Access price in Stripe:

1. Go to **Stripe Dashboard** → **Products**
2. Click **"+ Add product"**
3. Fill in:
   - **Name**: `Studio Access`
   - **Price**: `$99.00`
   - **Billing period**: `Monthly` (recurring)
4. Click **"Save product"**
5. Copy the **Price ID** (starts with `price_...`)
6. Add it to Supabase secrets as `STUDIO_ACCESS_PRICE_ID`

## After Updating

1. Try the checkout flow again
2. The success/cancel URLs will now redirect to your Vercel app
