# Fix Vercel npm install Error (Exit Code 254)

## Problem
Vercel build is failing with: `Command "npm install" exited with 254`

## Solution

### Step 1: Update Vercel Dashboard Settings

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **General**
2. Under **"Build & Development Settings"**:
   - **Install Command**: **DELETE IT** (leave it completely blank)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Node.js Version**: Set to `18.x` (or leave blank to auto-detect)
   - **Framework Preset**: `Other` (or leave blank)

3. **Click "Save"**

### Step 2: Clear Build Cache (Important!)

1. Go to **Deployments** tab
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**
4. **IMPORTANT**: Uncheck **"Use existing Build Cache"** (or clear cache)
5. Click **"Redeploy"**

### Step 3: Verify Build

Wait for the deployment to complete and check:
- Build logs should show successful `npm install`
- Build should complete with `npm run build`
- No exit code 254 errors

## Why This Works

- Vercel's auto-detected install command is more reliable
- Removing the custom install command lets Vercel handle it properly
- Clearing cache ensures a fresh build

## If Still Failing

Try these alternatives:

### Option A: Use Yarn
1. In Vercel Settings → General
2. **Install Command**: `yarn install --frozen-lockfile`
3. Make sure you have `yarn.lock` file (run `yarn install` locally first)

### Option B: Check Node Version
1. In Vercel Settings → General
2. **Node.js Version**: Explicitly set to `18.x`
3. The `.nvmrc` file should also specify `18`

### Option C: Check Build Logs
1. Go to **Deployments** → Latest → **View Build Logs**
2. Look for the exact error message
3. Check if it's a specific package failing

## Current Configuration

The `vercel.json` file now:
- ✅ Does NOT specify `installCommand` (lets Vercel auto-detect)
- ✅ Specifies `buildCommand`: `npm run build`
- ✅ Specifies `outputDirectory`: `dist`
- ✅ Has proper SPA routing rewrites
