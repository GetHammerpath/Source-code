# Check Cloudinary Setup for Video Stitching

If you're getting "Stitching Failed" errors, verify Cloudinary credentials are configured in Supabase.

## Steps:

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/secrets

2. **Verify these secrets exist:**
   - `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name (e.g., `your-cloud-name`)
   - `CLOUDINARY_API_KEY` - Your Cloudinary API key
   - `CLOUDINARY_API_SECRET` - Your Cloudinary API secret

3. **If missing, add them:**
   ```bash
   supabase secrets set CLOUDINARY_CLOUD_NAME=your-cloud-name
   supabase secrets set CLOUDINARY_API_KEY=your-api-key
   supabase secrets set CLOUDINARY_API_SECRET=your-api-secret
   ```

4. **Get your Cloudinary credentials:**
   - Sign up/login at https://cloudinary.com
   - Go to Dashboard → Settings → Access Keys
   - Copy Cloud Name, API Key, and API Secret

5. **Test the stitching function:**
   - After setting credentials, try "Smooth Merge" again
   - Check Supabase Edge Function logs: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/logs/edge-functions

## Common Errors:

- **"Cloudinary credentials not configured"** → Add the 3 secrets above
- **"Failed to download segment"** → Video URLs might be expired or inaccessible
- **"Failed to upload segment to Cloudinary"** → Check Cloudinary API key permissions
