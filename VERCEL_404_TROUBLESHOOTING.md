# Vercel 404 Error - Complete Troubleshooting Guide

## Quick Fix Checklist

### 1. Verify Vercel Project Settings

Go to **Vercel Dashboard → Your Project → Settings → General** and verify:

- ✅ **Framework Preset**: Should be **"Vite"** or **"Other"**
- ✅ **Build Command**: Should be `npm run build`
- ✅ **Output Directory**: Should be `dist`
- ✅ **Install Command**: Should be `npm install` (or leave blank)
- ✅ **Root Directory**: Should be `./` (blank/default)

### 2. Verify vercel.json is Being Read

1. Go to **Vercel Dashboard → Your Project → Settings → General**
2. Scroll down to see if it shows "Configuration detected from `vercel.json`"
3. If not, the file might not be in the root or Vercel isn't reading it

### 3. Check Build Output

1. Go to **Deployments → Latest Deployment → Build Logs**
2. Verify the build completed successfully
3. Check that `dist/index.html` exists in the build output

### 4. Manual Configuration Override

If `vercel.json` isn't working, manually set in Vercel Dashboard:

1. **Settings → General**
2. Under "Build & Development Settings":
   - **Framework Preset**: Select "Vite"
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. **Save**
4. **Redeploy**

### 5. Alternative: Use Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Link to project (if not already linked)
vercel link

# Deploy with explicit config
vercel --prod
```

### 6. Nuclear Option: Delete and Recreate Project

If nothing works:

1. **Delete the project** in Vercel Dashboard
2. **Create a new project** from the same GitHub repo
3. **Set all environment variables** again
4. **Deploy**

## Current Configuration Files

### vercel.json (Simplified)
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### public/_redirects (Backup)
```
/*    /index.html   200
```

## Testing After Fix

After redeploying, test these URLs:
- `https://your-app.vercel.app/` ✅ Should work
- `https://your-app.vercel.app/dashboard` ✅ Should work (not 404)
- `https://your-app.vercel.app/pricing` ✅ Should work (not 404)
- `https://your-app.vercel.app/admin` ✅ Should work (not 404)

## Common Issues

### Issue: "Configuration detected from vercel.json" not showing
**Solution**: Make sure `vercel.json` is in the root directory and committed to git

### Issue: Build succeeds but 404 on routes
**Solution**: The rewrites aren't working. Try:
1. Manually set Framework Preset to "Vite" in dashboard
2. Or use the simplified `vercel.json` we just created

### Issue: Assets (JS/CSS) not loading
**Solution**: The rewrites are too aggressive. The current config should exclude assets automatically.

## Still Not Working?

1. **Check Vercel Support Docs**: https://vercel.com/docs/configuration
2. **Check Build Logs**: Look for any warnings or errors
3. **Try a different approach**: Use Vercel's "Other" framework preset and manually configure
