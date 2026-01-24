# Edge Function Analysis - create-checkout-session

## Required Environment Variables

The `create-checkout-session` function requires these secrets to be set in Supabase:

### Critical (Will Cause Errors if Missing):

1. **STRIPE_SECRET_KEY** ⚠️
   - **Status**: Required, no default
   - **Issue**: If missing, Stripe client initializes with empty string, causing runtime errors
   - **Check**: Line 10 - `new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '')`
   - **Fix**: Must be set in Supabase Edge Function secrets

2. **SUPABASE_SERVICE_ROLE_KEY** ⚠️
   - **Status**: Required, no default
   - **Issue**: If missing, admin client can't access database (bypass RLS)
   - **Check**: Line 50 - used for profile operations
   - **Fix**: Must be set in Supabase Edge Function secrets
   - **Note**: This is different from SUPABASE_ANON_KEY

3. **STUDIO_ACCESS_PRICE_ID** ⚠️
   - **Status**: Required for subscription checkout
   - **Issue**: Explicitly checked at line 104, throws error if missing
   - **Fix**: Create price in Stripe Dashboard, then add to secrets

4. **SUPABASE_URL** ⚠️
   - **Status**: Required, no default
   - **Issue**: If missing, Supabase client won't work
   - **Check**: Lines 34, 49

5. **SUPABASE_ANON_KEY** ⚠️
   - **Status**: Required, no default
   - **Issue**: If missing, user authentication won't work
   - **Check**: Line 35

### Important (Has Defaults but Should Be Set):

6. **SITE_URL**
   - **Status**: Has default 'http://localhost:8080'
   - **Issue**: Default won't work in production
   - **Check**: Lines 112, 113, 143, 144
   - **Fix**: Set to your actual Vercel URL

### Optional (Has Defaults):

7. **KIE_COST_PER_MINUTE** - Default: '0.20'
8. **CREDIT_MARKUP_MULTIPLIER** - Default: '3'
9. **CREDITS_PER_MINUTE** - Default: '1'

## Code Issues Found

### Issue 1: Stripe Initialization with Empty String
**Location**: Line 10
```typescript
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
```
**Problem**: If `STRIPE_SECRET_KEY` is missing, Stripe is initialized with empty string, which will cause errors when trying to use it (e.g., `stripe.customers.create()`)

**Fix**: Should validate and throw error if missing

### Issue 2: No Early Validation of Required Secrets
**Problem**: The function doesn't validate required environment variables at startup, so errors occur deep in the execution flow

**Fix**: Add validation at the beginning of the function

### Issue 3: Error Messages Could Be More Specific
**Problem**: Some errors don't clearly indicate which secret is missing

**Fix**: Add specific error messages for each missing secret

## Recommended Fixes

1. **Add environment variable validation at function start**
2. **Improve error messages to indicate which secret is missing**
3. **Add logging for debugging**

## Verification Checklist

To verify all secrets are set correctly:

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions
2. Check these secrets exist:
   - [ ] `STRIPE_SECRET_KEY`
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` (most likely missing!)
   - [ ] `STUDIO_ACCESS_PRICE_ID`
   - [ ] `SITE_URL` = `https://source-code-p3jisk2ut-jon-brinkleys-projects.vercel.app`
   - [ ] `SUPABASE_URL`
   - [ ] `SUPABASE_ANON_KEY`
   - [ ] `KIE_COST_PER_MINUTE` = `0.20`
   - [ ] `CREDIT_MARKUP_MULTIPLIER` = `3`
   - [ ] `CREDITS_PER_MINUTE` = `1`

## Most Likely Issue

**Missing `SUPABASE_SERVICE_ROLE_KEY`** - This is required for the function to access the database with admin privileges (bypassing RLS). Without it, the function will fail when trying to:
- Get user profile (line 54)
- Create user profile (line 63)
- Update profile with stripe_customer_id (line 93)

## How to Fix

1. Go to Supabase Dashboard → **Settings → API**
2. Copy the **Service role key** (not the anon key!)
3. Go to **Settings → Functions → Secrets**
4. Add secret: `SUPABASE_SERVICE_ROLE_KEY` with the service role key value
5. Redeploy the function (or wait for it to pick up the new secret)
