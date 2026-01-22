# Deploy Edge Function via Supabase Dashboard

## Since CLI Installation Failed

You can deploy the Edge Function directly through the Supabase Dashboard:

### Option 1: Deploy via Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions

2. Click **"Create a new function"** or **"Deploy function"**

3. Function name: `create-checkout-session`

4. Copy the code from: `supabase/functions/create-checkout-session/index.ts`

5. Paste it into the editor

6. Click **"Deploy"**

### Option 2: Use npx (No Installation Needed)

Run these commands in your terminal:

```bash
cd /Users/mr.frierson/Desktop/Source-Code/Source-code

# Login (will open browser)
npx supabase login

# Link to project
npx supabase link --project-ref wzpswnuteisyxxwlnqrn

# Deploy the function
npx supabase functions deploy create-checkout-session
```

### Option 3: Install Supabase CLI via Homebrew (Mac)

```bash
brew install supabase/tap/supabase
```

Then:
```bash
supabase login
supabase link --project-ref wzpswnuteisyxxwlnqrn
supabase functions deploy create-checkout-session
```

## After Deploying

1. Go back to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. You should now see `create-checkout-session` in the list
3. Try checkout again in your app

## Also Deploy These Functions

After `create-checkout-session` works, also deploy:
- `create-portal-session`
- `stripe-webhook`

These are needed for the full billing flow.
