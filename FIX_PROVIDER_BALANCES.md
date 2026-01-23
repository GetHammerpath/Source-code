# Fix Provider Balances (Kie.ai & Fal.ai)

## Problem
Provider balances show "0 credits" and "Unavailable" because:
1. API endpoints might be incorrect
2. API keys might not be set as secrets
3. API response structure might be different

## Solution

### Step 1: Set API Keys as Secrets

Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

Set these secrets:
- `KIE_AI_API_TOKEN` = `36472cd29581ffdb407f9ffb15923264`
- `FAL_API_KEY` = `0ef6de6b-6145-4d18-b7c6-37f95f7cefde:2e433fd0dc9930381111d8db44fdb4bc`

### Step 2: Deploy Updated Function

The `fetch-provider-balances` function has been updated to:
- Try multiple API endpoints
- Better error handling
- Log responses for debugging

Deploy it:
1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Find `fetch-provider-balances`
3. Update it with the new code from `supabase/functions/fetch-provider-balances/index.ts`

### Step 3: Test the Function

1. Go to `/admin` or `/admin/providers`
2. Click "Refresh Balances"
3. Check the Edge Function logs for errors

### Step 4: Check Logs

If balances still show 0:
1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Click `fetch-provider-balances`
3. Check **Logs** tab
4. Look for:
   - Which endpoints were tried
   - What responses were received
   - Any error messages

## Note About API Endpoints

Kie.ai and Fal.ai may not have public balance endpoints. The function tries multiple common endpoints, but you may need to:

1. **Check Kie.ai/Fal.ai documentation** for the correct balance endpoint
2. **Contact their support** to get the balance API endpoint
3. **Use their dashboard** to manually check balances if no API exists

## Alternative: Manual Balance Entry

If no API endpoint exists, you can manually set balances:

```sql
-- Manually set Kie balance
INSERT INTO public.provider_balance_snapshots (
  provider,
  balance_value,
  balance_unit,
  fetched_at,
  raw_response_json
) VALUES (
  'kie',
  1000, -- Your actual balance
  'credits',
  NOW(),
  '{"manual": true}'
) ON CONFLICT DO NOTHING;

-- Manually set Fal balance
INSERT INTO public.provider_balance_snapshots (
  provider,
  balance_value,
  balance_unit,
  fetched_at,
  raw_response_json
) VALUES (
  'fal',
  500, -- Your actual balance
  'credits',
  NOW(),
  '{"manual": true}'
) ON CONFLICT DO NOTHING;
```
