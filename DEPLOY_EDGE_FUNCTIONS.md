# Deploy Supabase Edge Functions

## Problem
"Failed to send a request to the Edge Function" means the Edge Function isn't deployed or accessible.

## Solution: Deploy the Edge Function

### Option 1: Deploy via Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   cd /Users/mr.frierson/Desktop/Source-Code/Source-code
   supabase link --project-ref wzpswnuteisyxxwlnqrn
   ```

4. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy create-checkout-session
   ```

### Option 2: Deploy via Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Check if `create-checkout-session` is listed
3. If not, you need to deploy it via CLI (Option 1)

### Option 3: Verify Edge Function is Deployed

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Look for `create-checkout-session` in the list
3. If it's there, click on it to see details
4. Check the "Logs" tab to see if there are any errors

## Verify Edge Function Works

After deploying, test it:

1. Go to your app
2. Try checkout again
3. Check Supabase Edge Function logs:
   - **Supabase Dashboard** → **Functions** → **create-checkout-session** → **Logs**

## Common Issues

### Issue: "Function not found"
**Fix**: Deploy the Edge Function using the CLI (Option 1)

### Issue: "Unauthorized" or "Authentication failed"
**Fix**: Make sure you're logged in and the Edge Function has proper CORS headers

### Issue: "Failed to send request"
**Fix**: 
- Check Supabase project is active
- Verify Edge Function is deployed
- Check network tab in browser console for the actual HTTP error

## Quick Check

Run this command to see if the function is deployed:
```bash
supabase functions list
```

If `create-checkout-session` is not in the list, deploy it:
```bash
supabase functions deploy create-checkout-session
```
