# Set SUPABASE_SERVICE_ROLE_KEY Secret

## Quick Steps

1. **Go to Supabase Dashboard:**
   https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions

2. **Click "Add new secret"** (or edit if it already exists)

3. **Set:**
   - **Name:** `SUPABASE_SERVICE_ROLE_KEY`
   - **Value:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHN3bnV0ZWlzeXh4d2xucXJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTIxOTA1NSwiZXhwIjoyMDc0Nzk1MDU1fQ.7i1WfKIVo281KC_y8jdLB36WJHVdw5ThY92eNVE_nQ8`

4. **Click "Save"**

5. **The function will automatically pick up the new secret** - no redeploy needed!

6. **Try checkout again** - it should work now!

## Alternative: Via Supabase CLI (if dashboard doesn't work)

If the dashboard doesn't allow setting `SUPABASE_SERVICE_ROLE_KEY`, you might need to:
1. Use a different name like `SERVICE_ROLE_KEY` 
2. Update the Edge Function code to read from that name instead

But try the dashboard first - it should work!
