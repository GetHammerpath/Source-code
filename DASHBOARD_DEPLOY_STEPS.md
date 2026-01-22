# Deploy create-checkout-session via Supabase Dashboard

## Step-by-Step Instructions

### Step 1: Go to Supabase Functions
1. Open: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. You should see a list of functions (or an empty list if none are deployed)

### Step 2: Create New Function
1. Click **"Create a new function"** or **"New Function"** button
2. If you don't see that button, look for **"Deploy function"** or **"+"** icon

### Step 3: Enter Function Details
1. **Function name**: `create-checkout-session`
2. **Runtime**: Select **"Deno"** (if asked)
3. You'll see a code editor

### Step 4: Copy and Paste Code
1. Copy the ENTIRE code from the file below
2. Delete any placeholder code in the editor
3. Paste the code into the editor

### Step 5: Deploy
1. Click **"Deploy"** or **"Save"** button
2. Wait for deployment to complete (should take 10-30 seconds)
3. You should see a success message

### Step 6: Verify
1. Go back to the functions list
2. You should now see `create-checkout-session` in the list
3. Click on it to see details

## After Deployment

1. **Set the secrets** (if not already set):
   - Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions
   - Make sure these secrets are set:
     - `STRIPE_SECRET_KEY`
     - `STUDIO_ACCESS_PRICE_ID`
     - `SITE_URL`
     - `KIE_COST_PER_MINUTE`
     - `CREDIT_MARKUP_MULTIPLIER`
     - `CREDITS_PER_MINUTE`
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`

2. **Test checkout** in your app

## Full Code to Copy

See the file: `supabase/functions/create-checkout-session/index.ts`

Copy the ENTIRE contents of that file.
