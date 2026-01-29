# Environment Variables Setup

This document contains all API keys and environment variables needed for the application.

## ⚠️ IMPORTANT SECURITY NOTES

1. **Never commit the `.env` file to git** (it's already in `.gitignore`)
2. **Never share API keys publicly**
3. **Use different keys for development vs production**

## Frontend Environment Variables (.env file)

These are used by the React/Vite frontend:

```env
# Supabase Configuration (Frontend)
VITE_SUPABASE_URL=https://wzpswnuteisyxxwlnqrn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Rvk6d-mQaD7LN-FjXZjwXg_nc5HIHJ_

# Stripe Configuration (Frontend - Publishable Key)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51RvAcZRYkX2b1pR7xhewiVIPHokavVRCtrRCHaHSzpvZ9hQ9o1L66lMqx0Pdtht7PwSJgFbC2tVg9ZRXXJjN0CuK00Wz78Cop0

# Pricing Configuration (Frontend)
VITE_KIE_COST_PER_MINUTE=0.20
VITE_CREDIT_MARKUP_MULTIPLIER=3
VITE_CREDITS_PER_MINUTE=1

# Site URL (Frontend)
VITE_SITE_URL=http://localhost:8080
```

## Vercel API Routes (Serverless)

The landing-page casting interface calls `/api/generate-avatar`, which uses **Kie Nano Banana** (image generation) when configured. Set in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Purpose |
|----------|---------|
| `KIE_AI_API_TOKEN` or `KIE_API_KEY` | Kie.ai API key for Nano Banana avatar images. If unset, the API falls back to placeholder avatars. |

The same Kie.ai key used for Edge Functions can be used here. For long-running generation (4 images), ensure the function timeout is at least 60s (Vercel Pro; Hobby may cap at 10s).

## Supabase Edge Function Secrets

These need to be set in Supabase Dashboard or via CLI. **They are NOT in the .env file** for security.

### Required Secrets for Edge Functions:

Set these via Supabase Dashboard → Settings → Edge Functions → Secrets, or via CLI:

```bash
supabase secrets set SUPABASE_URL=https://wzpswnuteisyxxwlnqrn.supabase.co
supabase secrets set SUPABASE_ANON_KEY=sb_publishable_Rvk6d-mQaD7LN-FjXZjwXg_nc5HIHJ_
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHN3bnV0ZWlzeXh4d2xucXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIxOTA1NSwiZXhwIjoyMDc0Nzk1MDU1fQ.7i1WfKIVo281KC_y8jdLB36WJHVdw5ThY92eNVE_nQ8
```

### Provider API Keys (Edge Functions):

```bash
# Kie.ai API Token
supabase secrets set KIE_AI_API_TOKEN=36472cd29581ffdb407f9ffb15923264

# OpenAI API Key
supabase secrets set OPENAI_API_KEY=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
```

### Stripe Configuration (Edge Functions):

```bash
# Stripe Secret Key (DO NOT COMMIT - Set via Supabase Dashboard)
# Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions
# Add secret: STRIPE_SECRET_KEY = (your Stripe secret key from dashboard)
# supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_NEW_KEY_HERE

# Stripe Webhook Secret (CONFIGURED)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_LsQYDIUAdMbemoh51e6rrtSPeMXhi3Hj

# Studio Access Price ID (NEEDED)
# Create a $99/month subscription product in Stripe, then copy the Price ID
supabase secrets set STUDIO_ACCESS_PRICE_ID=price_...

# Site URL
supabase secrets set SITE_URL=https://your-domain.com
```

### Pricing Configuration (Edge Functions):

```bash
supabase secrets set KIE_COST_PER_MINUTE=0.20
supabase secrets set CREDIT_MARKUP_MULTIPLIER=3
supabase secrets set CREDITS_PER_MINUTE=1
```

## Missing Required Items

You still need to obtain:

1. ~~**Supabase Service Role Key**~~ ✅ **CONFIGURED** (set in Edge Functions secrets)
   - ⚠️ Keep this secret - it bypasses RLS policies

2. ~~**Stripe Secret Key**~~ ✅ **CONFIGURED** (set in Edge Functions secrets)

3. ~~**Stripe Webhook Secret**~~ ✅ **CONFIGURED** (set in Edge Functions secrets)

4. **Studio Access Price ID**
   - In Stripe Dashboard → Products → Create new product
   - Name: "Studio Access"
   - Price: $99/month, recurring
   - Copy the Price ID (starts with `price_...`)

## How to Set Supabase Secrets

### Option 1: Supabase Dashboard (Easiest)
1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions
2. Click "Add Secret"
3. Enter key name and value
4. Click "Save"

### Option 2: Supabase CLI
```bash
# Install Supabase CLI if needed
npm install -g supabase

# Login
supabase login

# Link to project
supabase link --project-ref wzpswnuteisyxxwlnqrn

# Set secrets
supabase secrets set KIE_AI_API_TOKEN=36472cd29581ffdb407f9ffb15923264
# ... (repeat for each secret)
```

## Verification

After setting all secrets, verify they're working:

1. **Test Supabase connection**: Sign up/login should work
2. **Test OpenAI**: Try generating a script in Long Form Generator
3. **Test Kie.ai**: Try generating a video
4. **Test Stripe**: Try creating a checkout session (will fail if secrets missing)

## Environment Variable Reference

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Frontend (.env) | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend (.env) | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Full database access |
| `KIE_AI_API_TOKEN` | Edge Functions, Vercel API | Kie.ai video + Nano Banana image (avatar) generation |
| `OPENAI_API_KEY` | Edge Functions | OpenAI script/prompt generation |
| `STRIPE_SECRET_KEY` | Edge Functions | Stripe payment processing |
| `STRIPE_WEBHOOK_SECRET` | Edge Functions | Webhook signature verification |
| `STUDIO_ACCESS_PRICE_ID` | Edge Functions | Studio Access subscription price |
