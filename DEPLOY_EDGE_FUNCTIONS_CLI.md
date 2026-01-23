# Deploy Edge Functions via CLI (Recommended)

## Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Or via npm
npm install -g supabase
```

## Login to Supabase

```bash
supabase login
```

## Link Your Project

```bash
cd /Users/mr.frierson/Desktop/Source-Code/Source-code
supabase link --project-ref wzpswnuteisyxxwlnqrn
```

## Deploy All Functions

```bash
# Deploy all functions at once
supabase functions deploy

# Or deploy specific function
supabase functions deploy fetch-provider-balances
supabase functions deploy admin-adjust-credits
supabase functions deploy admin-update-provider-settings
```

## Set Secrets via CLI

```bash
# Set secrets
supabase secrets set KIE_AI_API_TOKEN=36472cd29581ffdb407f9ffb15923264
supabase secrets set FAL_API_KEY=0ef6de6b-6145-4d18-b7c6-37f95f7cefde:2e433fd0dc9930381111d8db44fdb4bc
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STUDIO_ACCESS_PRICE_ID=price_...
# etc.
```

## Benefits

✅ **Faster** - Deploy all functions at once  
✅ **Version control** - Functions are in git  
✅ **Automated** - Can be part of CI/CD  
✅ **Less error-prone** - No copy/paste mistakes  

## Workflow

1. Edit function code locally
2. Test locally (optional): `supabase functions serve`
3. Deploy: `supabase functions deploy function-name`
4. Done!
