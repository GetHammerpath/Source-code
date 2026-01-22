# Deploy create-checkout-session Edge Function - URGENT

## Problem
"Failed to send a request to the Edge Function" means the Edge Function is not deployed.

## Quick Fix: Deploy via Supabase Dashboard

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Login and Link

```bash
cd /Users/mr.frierson/Desktop/Source-Code/Source-code
supabase login
supabase link --project-ref wzpswnuteisyxxwlnqrn
```

### Step 3: Deploy the Function

```bash
supabase functions deploy create-checkout-session
```

### Step 4: Deploy Other Missing Functions

```bash
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
```

## Alternative: Check if Function Exists

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Look for `create-checkout-session` in the list
3. If it's NOT there, you MUST deploy it using the CLI commands above

## After Deploying

1. Try checkout again
2. The error should be gone
3. Check Supabase Edge Function logs if there are still issues

## Most Important

**The Edge Function MUST be deployed for checkout to work!** The code exists in your repo, but Supabase doesn't know about it until you deploy it.
