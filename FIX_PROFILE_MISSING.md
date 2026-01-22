# Fix "Profile not found" Error

## Problem
The Edge Function is throwing "Profile not found" because your user account doesn't have a profile in the `profiles` table.

## Solution 1: Update the Deployed Function (Recommended)

I've updated the code to automatically create a profile if it doesn't exist. You need to update the deployed function:

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
2. Click on **"create-checkout-session"**
3. Click **"Edit"** or **"Update"**
4. Replace the code with the updated version (the function will now auto-create profiles)
5. Click **"Deploy"** or **"Save"**

## Solution 2: Manually Create Profile (Quick Fix)

Run this SQL in Supabase SQL Editor:

```sql
-- Get your user ID first
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then create the profile (replace USER_ID with your actual user ID)
INSERT INTO public.profiles (id, email, full_name)
VALUES (
  'USER_ID_HERE',
  'your-email@example.com',
  'Your Name'
)
ON CONFLICT (id) DO NOTHING;
```

## Solution 3: Check the Trigger

The trigger should auto-create profiles. Check if it exists:

```sql
-- Check if trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- If it doesn't exist, create it (from migration file)
```

## After Fixing

1. Try checkout again
2. The profile will be created automatically (if you updated the function)
3. Or manually create it using Solution 2

## Why This Happened

The database trigger `on_auth_user_created` should create profiles automatically when users sign up. If you signed up before this trigger was created, or if the trigger failed, you won't have a profile.

The updated Edge Function now handles this gracefully by creating the profile if it's missing.
