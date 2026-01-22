# Check if Admin Setup is Complete

## Check if mershard@icloud.com is Admin

Run this SQL in Supabase SQL Editor:

```sql
SELECT 
  u.email,
  ur.role,
  s.plan,
  s.status,
  s.current_period_end
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.subscriptions s ON u.id = s.user_id AND s.plan = 'studio_access'
WHERE u.email = 'mershard@icloud.com';
```

## Expected Results

You should see:
- ✅ `role = 'admin'`
- ✅ `plan = 'studio_access'`
- ✅ `status = 'active'`
- ✅ `current_period_end` = future date

## If Already Set Up

If you see the admin role and subscription, you can **delete the duplicate script** - it's already been applied.

## If Not Set Up

Run the migration file instead:
- File: `supabase/migrations/20250125000003_set_admin_user.sql`
- This is the official migration that will be tracked

## About the Script

The script you're asking about is a **duplicate** of:
- `supabase/migrations/20250125000003_set_admin_user.sql`

**Recommendation**: Delete the duplicate script and use the migration file if you need to re-run it.
