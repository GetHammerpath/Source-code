# Deployment Guide

This guide will help you deploy the application to Vercel (recommended) or other platforms.

## 🚀 Quick Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Go to [vercel.com](https://vercel.com)** and sign up/login
2. **Click "Add New Project"**
3. **Import your GitHub repository**:
   - Select `Project-Copy-And-Paste/Source-code`
   - Vercel will auto-detect it's a Vite project
4. **Configure Project Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)
5. **Add Environment Variables** (see below)
6. **Click "Deploy"**

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? (press enter for default)
# - Directory? ./ (default)
# - Override settings? No

# For production deployment
vercel --prod
```

## 📋 Required Environment Variables

Add these in **Vercel Dashboard → Project Settings → Environment Variables**:

### Frontend Environment Variables (VITE_ prefix)

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://wzpswnuteisyxxwlnqrn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Rvk6d-mQaD7LN-FjXZjwXg_nc5HIHJ_

# Stripe Configuration (Publishable Key)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51RvAcZRYkX2b1pR7xhewiVIPHokavVRCtrRCHaHSzpvZ9hQ9o1L66lMqx0Pdtht7PwSJgFbC2tVg9ZRXXJjN0CuK00Wz78Cop0

# Pricing Configuration
VITE_KIE_COST_PER_MINUTE=0.20
VITE_CREDIT_MARKUP_MULTIPLIER=3
VITE_CREDITS_PER_MINUTE=1

# Studio Access Price ID (get from Stripe Dashboard)
VITE_STUDIO_ACCESS_PRICE_ID=price_xxxxxxxxxxxxx

# Site URL (update with your Vercel domain)
VITE_SITE_URL=https://your-app.vercel.app
```

### Setting Environment Variables in Vercel

1. Go to your project in Vercel Dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://wzpswnuteisyxxwlnqrn.supabase.co`
   - **Environment**: Select `Production`, `Preview`, and `Development`
4. Repeat for all variables above
5. **Important**: After adding variables, trigger a new deployment

## 🔧 Post-Deployment Steps

### 1. Update Site URL

After deployment, Vercel will give you a URL like `https://your-app.vercel.app`

1. **Update `VITE_SITE_URL`** in Vercel environment variables
2. **Update Stripe Webhook URL**:
   - Go to Stripe Dashboard → Webhooks
   - Edit your webhook endpoint
   - Update URL to: `https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/stripe-webhook`
   - (This is your Supabase Edge Function URL, not Vercel)

### 2. Configure Custom Domain (Optional)

1. In Vercel Dashboard → **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update `VITE_SITE_URL` to your custom domain

### 3. Verify Supabase Edge Functions

Your Supabase Edge Functions are already deployed separately. Verify they're working:

- **Stripe Webhook**: `https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/stripe-webhook`
- **Checkout Session**: `https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/create-checkout-session`
- **Provider Balances**: `https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/fetch-provider-balances`

## 🔄 Automatic Deployments

Vercel automatically deploys on every push to `main` branch:

- **Production**: Deploys from `main` branch
- **Preview**: Deploys from pull requests and other branches

## 🐛 Troubleshooting

### Build Fails

1. **Check build logs** in Vercel Dashboard
2. **Verify all environment variables** are set
3. **Check Node version**: Vercel uses Node 18.x by default (should work)

### White Screen / App Not Loading

1. **Check browser console** for errors
2. **Verify environment variables** are set correctly
3. **Check Supabase connection**: Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct
4. **Verify build output**: Check that `dist/index.html` exists

### Stripe Not Working

1. **Verify Stripe keys** are set correctly
2. **Check webhook URL** in Stripe Dashboard
3. **Verify `STUDIO_ACCESS_PRICE_ID`** is set in Supabase Edge Function secrets (not Vercel)

### Supabase Edge Functions Not Working

Edge Functions are deployed separately via Supabase. They're not part of the Vercel deployment.

1. **Check Supabase Dashboard** → Edge Functions
2. **Verify secrets** are set in Supabase (see `ENV_SETUP.md`)
3. **Test functions** directly via Supabase Dashboard

## 📊 Deployment Checklist

- [ ] Vercel project created and connected to GitHub
- [ ] All `VITE_*` environment variables added to Vercel
- [ ] Build succeeds without errors
- [ ] App loads at Vercel URL
- [ ] Supabase connection works (can sign up/login)
- [ ] Stripe checkout works (test mode first)
- [ ] Custom domain configured (if applicable)
- [ ] `VITE_SITE_URL` updated to production URL
- [ ] Stripe webhook URL verified

## 🔐 Security Notes

1. **Never commit `.env` files** (already in `.gitignore`)
2. **Use different keys for dev/prod** if possible
3. **Rotate keys** if they're ever exposed
4. **Monitor Vercel logs** for errors
5. **Set up Vercel alerts** for failed deployments

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

## 🆘 Need Help?

If deployment fails:
1. Check Vercel build logs
2. Verify all environment variables
3. Test locally first: `npm run build && npm run preview`
4. Check GitHub Actions (if configured)
