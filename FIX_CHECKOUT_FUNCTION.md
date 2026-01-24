# Fixed: create-checkout-session Edge Function

## Changes Made

### 1. Added Environment Variable Validation
- Function now validates all required environment variables at startup and on each request
- Provides clear error messages indicating which secrets are missing
- Validates: `STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### 2. Improved Error Messages
- Error messages now include helpful instructions on how to fix the issue
- Specific guidance for:
  - Missing `SUPABASE_SERVICE_ROLE_KEY` → "Get from Supabase Dashboard → Settings → API"
  - Missing `STUDIO_ACCESS_PRICE_ID` → "Create price in Stripe Dashboard → Products"
  - Missing `STRIPE_SECRET_KEY` → "Set in Supabase Edge Function secrets"

### 3. Added Stripe Secret Key Validation
- Checks if `STRIPE_SECRET_KEY` exists before attempting Stripe operations
- Prevents cryptic Stripe API errors when key is missing

### 4. Better Logging
- Added console warnings when critical secrets are missing
- Added timestamps to error responses for debugging

## Required Secrets Checklist

Make sure these are set in **Supabase Dashboard → Settings → Functions → Secrets**:

- [ ] `STRIPE_SECRET_KEY` - Your Stripe secret key (starts with `sk_...`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - From Supabase Dashboard → Settings → API → Service role key
- [ ] `STUDIO_ACCESS_PRICE_ID` - Create $99/month price in Stripe, then copy Price ID (starts with `price_...`)
- [ ] `SITE_URL` - Your Vercel URL: `https://source-code-p3jisk2ut-jon-brinkleys-projects.vercel.app`
- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Your Supabase anon/public key
- [ ] `KIE_COST_PER_MINUTE` - `0.20` (optional, has default)
- [ ] `CREDIT_MARKUP_MULTIPLIER` - `3` (optional, has default)
- [ ] `CREDITS_PER_MINUTE` - `1` (optional, has default)

## Next Steps

1. **Deploy the updated function:**
   ```bash
   supabase functions deploy create-checkout-session
   ```

2. **Verify all secrets are set** in Supabase Dashboard

3. **Test checkout again** - you should now get much clearer error messages if something is still missing

4. **Check Edge Function logs** if errors persist:
   - Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions/create-checkout-session/logs
   - The logs will show exactly which secret is missing

## Most Common Issue

**Missing `SUPABASE_SERVICE_ROLE_KEY`** - This is the #1 cause of checkout failures. The function needs this to:
- Access user profiles (bypassing RLS)
- Create profiles if they don't exist
- Update profiles with Stripe customer IDs

Get it from: **Supabase Dashboard → Settings → API → Service role key** (not the anon key!)
