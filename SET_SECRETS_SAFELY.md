# How to Set Secrets Safely

## ✅ Safe Method: Supabase Dashboard

**This is the ONLY way you should set secrets - it's 100% secure:**

1. Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/settings/functions
2. Click "Add secret" or edit existing secret
3. Enter:
   - **Name:** `STRIPE_SECRET_KEY`
   - **Value:** `sk_live_YOUR_NEW_KEY` (paste from Stripe Dashboard)
4. Click "Save"

✅ **This is secure because:**
- Secret is stored encrypted in Supabase
- Never touches your local files
- Never gets committed to git
- Only accessible via Supabase Dashboard

## ✅ Alternative: Supabase CLI (Also Safe)

```bash
# This command sets the secret in Supabase, NOT in any file
supabase secrets set STRIPE_SECRET_KEY=sk_live_YOUR_NEW_KEY --project-ref wzpswnuteisyxxwlnqrn
```

✅ **This is secure because:**
- Secret is sent directly to Supabase API
- Not stored in any local file
- Not committed to git

## ❌ NEVER Do This

❌ **Don't create a file with the secret:**
```bash
# BAD - This could get committed!
echo "STRIPE_SECRET_KEY=sk_live_..." > secrets.txt
```

❌ **Don't put it in documentation:**
```markdown
# BAD - This gets committed to git!
STRIPE_SECRET_KEY=sk_live_...
```

❌ **Don't put it in setup scripts:**
```bash
# BAD - This gets committed to git!
supabase secrets set STRIPE_SECRET_KEY=sk_live_ACTUAL_KEY
```

## 🔒 How We Prevent Exposure

1. **All secret files are in `.gitignore`**
   - If you create a local file, it won't be committed

2. **Documentation uses placeholders**
   - All `.md` files use `YOUR_KEY_HERE` not actual keys

3. **GitHub blocks secrets**
   - GitHub will reject pushes with exposed secrets

4. **Code reads from environment**
   - Edge Functions read from `Deno.env.get()`, not files

## ✅ Verification

After setting your secret, verify it's not exposed:

```bash
# This should return nothing
git grep "sk_live"

# Check what files are tracked
git ls-files | grep -i secret
```

## 📝 Summary

**The ONLY safe place for your Stripe key:**
- ✅ Supabase Dashboard → Settings → Functions → Secrets
- ✅ Supabase CLI (sets directly in Supabase)

**NEVER put it in:**
- ❌ Any file that gets committed to git
- ❌ Documentation files
- ❌ Setup scripts
- ❌ Screenshots or messages

Your new key will be safe! 🛡️
