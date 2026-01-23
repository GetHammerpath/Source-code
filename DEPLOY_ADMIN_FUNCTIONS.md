# Deploy Admin Edge Functions

## New Edge Functions to Deploy

Two new Edge Functions need to be deployed to Supabase:

1. **`admin-adjust-credits`** - Handles credit adjustments
2. **`admin-update-provider-settings`** - Handles provider settings updates

## Deployment Steps

### Option 1: Deploy via Supabase Dashboard (Recommended)

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions

2. For each function:
   - Click **"Create a new function"** or find the function if it exists
   - Function name: `admin-adjust-credits` (then repeat for `admin-update-provider-settings`)
   - Copy the code from:
     - `supabase/functions/admin-adjust-credits/index.ts`
     - `supabase/functions/admin-update-provider-settings/index.ts`
   - Paste into the editor
   - Click **"Deploy"**

### Option 2: Deploy via Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref wzpswnuteisyxxwlnqrn

# Deploy the functions
supabase functions deploy admin-adjust-credits
supabase functions deploy admin-update-provider-settings
```

## Verify Deployment

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. You should see both functions listed:
   - `admin-adjust-credits`
   - `admin-update-provider-settings`
3. Check the logs to ensure no errors

## Required Secrets

Make sure these secrets are set in Supabase:
- `STRIPE_SECRET_KEY`
- `STUDIO_ACCESS_PRICE_ID`
- `SITE_URL`
- `KIE_COST_PER_MINUTE`
- `CREDIT_MARKUP_MULTIPLIER`
- `CREDITS_PER_MINUTE`

The functions use these automatically provided secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testing

After deployment, test the functions:

1. **Test Credit Adjustment:**
   - Go to `/admin/credits`
   - Click "Adjust Credits"
   - Select a user and make an adjustment
   - Check that it works

2. **Test Provider Settings:**
   - Go to `/admin/providers`
   - Click "Edit" on a provider
   - Update settings
   - Check that it works

## Vercel Deployment

The frontend code is automatically deployed to Vercel when you push to `main` branch.

Check deployment status:
- https://vercel.com/dashboard

The admin pages should be live once Vercel finishes building.
