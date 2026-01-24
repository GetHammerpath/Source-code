# Secure Secret Setup Guide

## ✅ How We Prevent Secret Exposure

### 1. Files Are Gitignored
The following files are now in `.gitignore` and will **NEVER** be committed:
- `SUPABASE_SECRETS.txt` (if you create a local copy)
- `.gitignore.local` (local secrets file)
- `*.secrets`, `*.keys` (any secret files)
- `.env*.local` (local environment files)

### 2. Documentation Files Use Placeholders
All documentation files now use placeholders like:
- `REPLACE_WITH_YOUR_KEY_HERE`
- `sk_live_YOUR_KEY_HERE`
- Never actual keys

### 3. Safe Ways to Set Secrets

#### Option A: Supabase Dashboard (Recommended - Most Secure)
1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions
2. Click "Add secret" or edit existing
3. Enter name and value
4. **Never copy/paste from here to any file that gets committed**

#### Option B: Supabase CLI (Safe - Only sets in Supabase)
```bash
# This sets the secret in Supabase, NOT in any file
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_NEW_KEY --project-ref wzpswnuteisyxxwlnqrn
```
✅ Safe because it only sets in Supabase, not in files

#### Option C: Local File (For Your Reference Only)
1. Copy `.gitignore.local.example` to `.gitignore.local`
2. Fill in your secrets (this file is gitignored)
3. Use it as a reference, but **never commit it**

### 4. Pre-Commit Checks

Before committing, always:
1. **Check what you're committing:**
   ```bash
   git status
   git diff
   ```

2. **Search for exposed keys:**
   ```bash
   # Search for Stripe keys in staged files
   git diff --cached | grep -i "sk_live"
   ```

3. **Verify .gitignore is working:**
   ```bash
   # This should show nothing if secrets are properly ignored
   git status --ignored | grep -i secret
   ```

### 5. GitHub Push Protection
GitHub will automatically block pushes containing secrets (as you saw). This is your safety net!

## 🚫 What NOT to Do

❌ **NEVER:**
- Put secrets in `.md` files (documentation)
- Put secrets in `.sh` scripts that get committed
- Put secrets in any file that's not in `.gitignore`
- Copy secrets from Supabase Dashboard into code files
- Share secrets in screenshots or messages

✅ **ALWAYS:**
- Use Supabase Dashboard for Edge Function secrets
- Use Vercel Dashboard for frontend environment variables
- Keep secrets only in secure services (Supabase, Vercel)
- Use placeholders in documentation

## 🔒 Current Security Status

### Files That Are Safe (Gitignored)
- ✅ `.gitignore.local` - Local secrets (if you create it)
- ✅ `SUPABASE_SECRETS.txt` - Now gitignored
- ✅ `.env*.local` - Local environment files

### Files That Are Safe (No Secrets)
- ✅ All `.md` files - Use placeholders only
- ✅ All code files - Read from environment variables
- ✅ Setup scripts - Use placeholders

### Where Secrets Should Live
- ✅ **Supabase Edge Function Secrets** (Dashboard)
- ✅ **Vercel Environment Variables** (Dashboard)
- ✅ **Local `.env.local`** (gitignored, for development only)

## 📋 Checklist Before Committing

Before every commit, verify:
- [ ] No actual API keys in any files
- [ ] No secrets in documentation
- [ ] `.gitignore` includes all secret files
- [ ] `git status` doesn't show secret files
- [ ] `git diff` doesn't show secrets

## 🛡️ Additional Protection

### GitHub Secret Scanning
GitHub automatically scans for exposed secrets and will:
- Block pushes with secrets (you experienced this)
- Alert you if secrets are found
- Help you rotate compromised keys

### Regular Audits
Periodically check:
```bash
# Search entire codebase for potential secrets
grep -r "sk_live" . --exclude-dir=node_modules --exclude-dir=.git
grep -r "sk_test" . --exclude-dir=node_modules --exclude-dir=.git
```

If you find any, remove them immediately!

## ✅ After You Update the Key

1. **Set it in Supabase Dashboard only**
2. **Test that checkout works**
3. **Never copy it to any file**
4. **Verify it's not in git:**
   ```bash
   git grep "sk_live"  # Should return nothing
   ```

Your new key will be safe because:
- ✅ It's only in Supabase (encrypted, secure)
- ✅ It's not in any files that get committed
- ✅ GitHub will block it if accidentally committed
- ✅ All documentation uses placeholders
