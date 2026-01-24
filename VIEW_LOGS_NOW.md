# View Edge Function Logs to See Exact Error

## Quick Steps

1. **Go to Supabase Dashboard:**
   https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions/create-checkout-session/logs

2. **Try checkout again** in your app (click "Continue to Payment")

3. **Refresh the logs page** or wait a few seconds

4. **Look at the most recent log entry** - it will show:
   - The exact error message
   - Which line failed
   - Stack trace
   - All the details you need

## What to Look For

The log will show one of these errors:

### "Missing required environment variables: STRIPE_SECRET_KEY"
**Fix:** Add your Stripe secret key to Edge Function secrets

### "Missing required environment variables: SERVICE_ROLE_KEY"
**Fix:** The secret should already be set, but verify it's there

### "STUDIO_ACCESS_PRICE_ID not configured"
**Fix:** Create the $99/month price in Stripe and add the Price ID

### "Failed to create profile" or database error
**Fix:** Usually means SERVICE_ROLE_KEY is incorrect or missing

### Stripe API error
**Fix:** Check if STRIPE_SECRET_KEY is correct

## After Finding the Error

Share the exact error message from the logs, and I can help you fix it!
