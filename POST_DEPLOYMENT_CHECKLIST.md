# Post-Deployment Checklist

## ✅ Deployment Complete!

Your application is now live on Vercel. Follow these steps to ensure everything is working correctly.

## 🔍 Immediate Checks

### 1. Test Your Live URL
- Visit your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
- Verify the homepage loads
- Test navigation to different routes:
  - `/dashboard`
  - `/pricing`
  - `/admin` (if you're an admin)

### 2. Verify Environment Variables

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Make sure these are set (for Production, Preview, and Development):

```env
VITE_SUPABASE_URL=https://wzpswnuteisyxxwlnqrn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_Rvk6d-mQaD7LN-FjXZjwXg_nc5HIHJ_
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51RvAcZRYkX2b1pR7xhewiVIPHokavVRCtrRCHaHSzpvZ9hQ9o1L66lMqx0Pdtht7PwSJgFbC2tVg9ZRXXJjN0CuK00Wz78Cop0
VITE_KIE_COST_PER_MINUTE=0.20
VITE_CREDIT_MARKUP_MULTIPLIER=3
VITE_CREDITS_PER_MINUTE=1
VITE_STUDIO_ACCESS_PRICE_ID=price_xxxxxxxxxxxxx
VITE_SITE_URL=https://your-app.vercel.app
```

**Important**: Update `VITE_SITE_URL` to your actual Vercel URL!

### 3. Test Core Functionality

- [ ] **Authentication**: Sign up / Sign in works
- [ ] **Supabase Connection**: Data loads correctly
- [ ] **Dashboard**: User dashboard displays
- [ ] **Admin Panel**: Accessible if you're an admin (`mershard@icloud.com`)
- [ ] **Routing**: All routes work (no 404 errors)

### 4. Update Stripe Webhook URL

1. Go to **Stripe Dashboard** → **Webhooks**
2. Edit your webhook endpoint
3. Verify the URL points to your Supabase Edge Function:
   - `https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/stripe-webhook`
4. Test the webhook is receiving events

### 5. Custom Domain (Optional)

If you have a custom domain:
1. Go to **Vercel Dashboard** → **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update `VITE_SITE_URL` to your custom domain

## 🐛 Troubleshooting

### If you see a white screen:
1. Check browser console (F12) for errors
2. Verify all environment variables are set
3. Check Vercel build logs for errors

### If authentication doesn't work:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are correct
2. Check Supabase project is active
3. Verify RLS policies are set correctly

### If Stripe checkout doesn't work:
1. Verify `VITE_STRIPE_PUBLISHABLE_KEY` is set
2. Check Stripe webhook is configured
3. Verify `STUDIO_ACCESS_PRICE_ID` is set in Supabase Edge Function secrets

## 📊 Monitoring

- **Vercel Analytics**: Check deployment performance
- **Build Logs**: Monitor for any build issues
- **Function Logs**: Check Supabase Edge Function logs

## 🎉 Next Steps

1. Share your live URL with your team
2. Set up monitoring/alerts
3. Configure custom domain (if needed)
4. Test all features thoroughly
5. Set up CI/CD (already done - auto-deploys on push to main!)

## 📝 Notes

- **Auto-deployment**: Every push to `main` branch will automatically deploy
- **Preview deployments**: Pull requests get preview URLs automatically
- **Environment variables**: Make sure to set them for Production, Preview, AND Development

---

**Congratulations! Your application is live! 🚀**
