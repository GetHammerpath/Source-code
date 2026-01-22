# Fix Vercel "Could not read package.json" Error

## Error
```
npm error enoent Could not read package.json: Error: ENOENT: no such file or directory, open '/vercel/path0/package.json'
```

## Root Cause
Vercel can't find `package.json` because the **Root Directory** setting is wrong, OR Vercel is connected to the wrong GitHub repository.

## Solution

### Option 1: Fix Root Directory in Vercel Dashboard

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **General**
2. Scroll to **"Root Directory"**
3. **IMPORTANT**: Make sure it's set to:
   - **Blank/Empty** (default) - if your `package.json` is in the repo root
   - OR the exact path if your project is in a subdirectory

4. **Verify these settings**:
   - **Root Directory**: **LEAVE BLANK** (empty)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: **LEAVE BLANK**
   - **Node.js Version**: `20.x`

5. Click **"Save"**

### Option 2: Check GitHub Repository Connection

The error shows Vercel is cloning from:
- `github.com/GetHammerpath/Hammerpath-copy-and-paste`

But your local git shows:
- `Project-Copy-And-Paste/Source-code`

**If these don't match**, you need to:

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Git**
2. Check which repository is connected
3. If wrong, disconnect and reconnect to the correct repo:
   - `Project-Copy-And-Paste/Source-code`

### Option 3: Verify package.json is in Root

Make sure `package.json` is in the root of your GitHub repository:

1. Go to your GitHub repo: `https://github.com/Project-Copy-And-Paste/Source-code`
2. Verify `package.json` is visible in the root directory
3. If it's in a subdirectory, set **Root Directory** in Vercel to that path

### Step 4: Redeploy

After fixing the settings:
1. Go to **Deployments**
2. Click **"..."** → **"Redeploy"**
3. Uncheck **"Use existing Build Cache"**
4. Click **"Redeploy"**

## Most Likely Fix

**Set Root Directory to blank/empty** in Vercel Dashboard. This is the #1 cause of this error.
