# How to Check Credit Charging Status

## Option 1: Use the Billing Page (Easiest)

1. Go to **Billing & Credits** page in your app
2. Scroll to the **"Credit Balance"** card
3. Click **"Charge for completed videos"** button
4. Check the toast message - it will tell you:
   - How many videos were charged
   - How many credits were deducted
   - Or if no videos needed charging

## Option 2: Check Supabase Logs

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Edge Functions** → **retroactively-charge-credits**
4. Click **Logs** tab
5. Look for recent invocations and check:
   - `🔍 Finding completed videos...`
   - `Found X total generations`
   - `Filtered to X completed generations`
   - `📊 X videos need credit charging`
   - `✅ Charged X credits...`

## Option 3: Check Database Directly

Run this SQL in Supabase SQL Editor:

```sql
-- Check completed videos
SELECT 
  id,
  initial_status,
  extended_status,
  number_of_scenes,
  jsonb_array_length(video_segments) as segment_count,
  CASE 
    WHEN final_video_url IS NOT NULL THEN 'Has final video'
    WHEN jsonb_array_length(video_segments) > 0 THEN 'Has segments'
    WHEN initial_video_url IS NOT NULL OR extended_video_url IS NOT NULL THEN 'Has video URLs'
    ELSE 'No videos'
  END as completion_status,
  created_at
FROM kie_video_generations
WHERE 
  initial_status = 'completed' 
  OR extended_status = 'completed'
  OR final_video_url IS NOT NULL
  OR jsonb_array_length(video_segments) > 0
  OR initial_video_url IS NOT NULL
  OR extended_video_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 20;

-- Check which videos have been charged
SELECT 
  tx.metadata->>'generation_id' as generation_id,
  tx.amount,
  tx.balance_after,
  tx.created_at,
  tx.metadata->>'scenes_completed' as scenes,
  tx.metadata->>'retroactive' as is_retroactive
FROM credit_transactions tx
WHERE tx.type = 'debit'
  AND tx.metadata->>'generation_id' IS NOT NULL
ORDER BY tx.created_at DESC
LIMIT 20;

-- Check your current credit balance
SELECT 
  credits,
  updated_at
FROM credit_balance
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com');
```

## Option 4: Run Diagnostic Script

If you have `SUPABASE_SERVICE_ROLE_KEY` in your `.env` file:

```bash
npm run check:credits
```

This will show:
- Total video generations
- Which ones are completed
- Which ones have been charged
- Your current credit balance
- Expected credits for uncharged videos

## Common Issues

### "No completed videos found"
- Your videos might still be processing
- Check if videos have `initial_status = 'completed'` or `extended_status = 'completed'`
- Check if videos have `video_segments` with URLs
- Check if videos have `initial_video_url` or `extended_video_url`

### "All completed videos have been charged"
- Credits were already deducted
- Check your transaction history on the Billing page

### Credits still showing 100
- The function might not be finding your videos (check logs)
- Videos might not be marked as completed
- Try manually deducting credits using the "Deduct Kie credits" section

## Manual Fix

If automatic charging isn't working, you can manually deduct credits:

1. Go to **Billing & Credits** page
2. In **"Deduct Kie credits"** section:
   - Enter the number of credits used (1 credit per scene, 8 seconds each)
   - Add a reason (optional)
   - Click **"Deduct"**

Example: If you created a 3-scene video (24 seconds), deduct 3 credits.
