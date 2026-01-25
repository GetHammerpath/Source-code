# Edge Function Deployment Options

## Option 1: Supabase CLI (Recommended) ⭐

**Best for:** Development and regular updates

### Setup (One Time)
```bash
# Install CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link project
cd /Users/mr.frierson/Desktop/Source-Code/Source-code
supabase link --project-ref wzpswnuteisyxxwlnqrn
```

### Deploy Functions
```bash
# Deploy all functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy fetch-provider-balances
```

### Set Secrets
```bash
supabase secrets set KIE_AI_API_TOKEN=your_key
```

**Pros:**
- ✅ Fast and automated
- ✅ Version controlled
- ✅ Can deploy multiple functions at once
- ✅ Less error-prone

**Cons:**
- ❌ Requires CLI installation
- ❌ Need to run commands manually

---

## Option 2: Supabase Dashboard (Current Method)

**Best for:** Quick one-off updates

### Steps
1. Go to Functions dashboard
2. Click function name
3. Click "Edit"
4. Copy/paste code
5. Click "Deploy"

**Pros:**
- ✅ No CLI needed
- ✅ Visual interface
- ✅ Good for quick fixes

**Cons:**
- ❌ Slow for multiple functions
- ❌ Copy/paste errors
- ❌ Not version controlled
- ❌ Manual process

---

## Option 3: Git + CI/CD (Advanced)

**Best for:** Production automation

Set up GitHub Actions or similar to auto-deploy on push to main.

**Pros:**
- ✅ Fully automated
- ✅ Version controlled
- ✅ No manual steps

**Cons:**
- ❌ More complex setup
- ❌ Requires CI/CD knowledge

---

## Recommendation

**For now:** Use **Option 1 (CLI)** - it's the best balance of speed and simplicity.

**Quick start:**
```bash
# Install once
brew install supabase/tap/supabase

# Login once
supabase login

# Link project once
supabase link --project-ref wzpswnuteisyxxwlnqrn

# Then deploy anytime:
supabase functions deploy fetch-provider-balances
```

This way you don't need to manually copy/paste code in the dashboard every time!
