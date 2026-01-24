# URGENT: Fix Exposed Stripe Key

## ⚠️ Security Issue
Your Stripe live API key has been exposed in your codebase and is publicly visible on GitHub.

## Immediate Actions Required

### Step 1: Create New Stripe Key (Do This First!)

1. **Go to Stripe Dashboard:**
   https://dashboard.stripe.com/apikeys

2. **Click "Create secret key"** (or "Add key" if you see that)

3. **Copy the NEW key** (starts with `sk_live_...`)

4. **DO NOT share this key anywhere!**

### Step 2: Update Supabase Edge Function Secret

1. **Go to Supabase Dashboard:**
   https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

2. **Find `STRIPE_SECRET_KEY` in the secrets list**

3. **Click to edit it**

4. **Replace with your NEW key** from Step 1

5. **Save**

### Step 3: Deactivate Old Key in Stripe

1. **Go to Stripe Dashboard:**
   https://dashboard.stripe.com/apikeys

2. **Find the OLD key** (ending in `...hC96w`)

3. **Click the "..." menu** next to it

4. **Click "Reveal key"** to confirm it's the exposed one

5. **Click "Delete key"** or "Revoke key"

6. **Confirm deletion**

### Step 4: Remove Key from Codebase

The exposed key has been removed from these files:
- ✅ `ENV_SETUP.md`
- ✅ `UPDATE_SITE_URL.md`
- ✅ `SUPABASE_SECRETS.txt`
- ✅ `STRIPE_CHECKOUT_FIX.md`
- ✅ `SETUP_SECRETS.sh`

**Commit and push these changes immediately!**

### Step 5: Check for Other Exposures

1. **Check your GitHub repository:**
   - Go to your repo on GitHub
   - Search for the old key (ending in `...hC96w`)
   - If found in commit history, you may need to:
     - Remove the file from git history (using `git filter-branch` or BFG Repo-Cleaner)
     - Or make the repository private

2. **Check Vercel environment variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Make sure `VITE_STRIPE_PUBLISHABLE_KEY` is set (this is safe to be public)
   - Do NOT set `STRIPE_SECRET_KEY` here (it should only be in Supabase)

3. **Check any other services:**
   - Any CI/CD pipelines
   - Any deployment scripts
   - Any documentation sites

### Step 6: Review Stripe API Logs

1. **Go to Stripe Dashboard:**
   https://dashboard.stripe.com/logs

2. **Review recent API calls** for any suspicious activity

3. **Look for:**
   - Unusual API calls
   - Calls from unknown IPs
   - Unexpected charge attempts
   - Customer data access

### Step 7: Rotate Other Keys (Recommended)

1. **Rotate your Stripe Publishable Key** (optional but recommended):
   - Go to: https://dashboard.stripe.com/apikeys
   - Create a new publishable key
   - Update `VITE_STRIPE_PUBLISHABLE_KEY` in Vercel

2. **Rotate webhook signing secret** (if you have webhooks):
   - Go to: https://dashboard.stripe.com/webhooks
   - Create a new endpoint or regenerate signing secret
   - Update `STRIPE_WEBHOOK_SECRET` in Supabase

## Prevention

### Never Commit Secrets to Git

1. **Use environment variables** for all secrets
2. **Add secret files to `.gitignore`**
3. **Use Supabase secrets** for Edge Functions
4. **Use Vercel environment variables** for frontend (only publishable keys)

### Files That Should NEVER Contain Secrets

- ❌ Documentation files (`.md`)
- ❌ Setup scripts (`.sh`)
- ❌ Configuration files (unless in `.gitignore`)
- ❌ Any file committed to git

### Safe Places for Secrets

- ✅ Supabase Edge Function secrets (for backend)
- ✅ Vercel environment variables (for frontend, only publishable keys)
- ✅ `.env.local` files (in `.gitignore`)
- ✅ Private password managers

## After Fixing

1. ✅ New Stripe key created
2. ✅ Old key deactivated in Stripe
3. ✅ New key set in Supabase Edge Function secrets
4. ✅ Exposed key removed from codebase
5. ✅ Changes committed and pushed
6. ✅ Stripe API logs reviewed
7. ✅ Test checkout to verify new key works

## Test After Fixing

1. Try the checkout flow again
2. Verify payments work correctly
3. Check Stripe Dashboard for successful API calls
