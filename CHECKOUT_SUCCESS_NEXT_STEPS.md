# Checkout Success - Next Steps

## ✅ What Just Worked

1. **Checkout Session Created** - The Edge Function successfully:
   - Found/created your user profile
   - Created/retrieved Stripe customer
   - Created Stripe Checkout Session
   - Redirected you to Stripe

## 🔄 What Happens Next

### After You Complete Payment in Stripe

1. **Stripe Webhook** will fire `checkout.session.completed`
2. **Your webhook handler** (`stripe-webhook` Edge Function) should:
   - Grant Studio Access subscription
   - Update `subscriptions` table
   - Update `profiles` table with subscription status

### After Payment Completes

1. **You'll be redirected to**: `/checkout/success`
2. **Check your subscription status**:
   - Go to `/account/billing`
   - You should see "Studio Access: Active"
   - Renewal date should be shown

## 🧪 Test the Full Flow

### 1. Complete the Stripe Payment
- Use Stripe test card: `4242 4242 4242 4242`
- Any future expiry date
- Any CVC

### 2. Check Webhook Processing
- Go to: https://supabase.com/dashboard/project/wzpswnuteisyxxwlnqrn/functions
- Click on **"stripe-webhook"**
- Check **Logs** tab for webhook events

### 3. Verify Subscription in Database
Run this SQL in Supabase:

```sql
SELECT 
  u.email,
  s.plan,
  s.status,
  s.stripe_subscription_id,
  s.current_period_end
FROM auth.users u
JOIN public.subscriptions s ON u.id = s.user_id
WHERE u.email = 'your-email@example.com';
```

### 4. Check Billing Page
- Go to `/account/billing` in your app
- Should show:
  - ✅ Studio Access: Active
  - Renewal date
  - "Manage Studio Access" button (Stripe Portal)

## 🐛 If Webhook Doesn't Work

### Check Webhook Endpoint
1. Go to Stripe Dashboard → Webhooks
2. Verify endpoint URL is set to:
   - `https://wzpswnuteisyxxwlnqrn.supabase.co/functions/v1/stripe-webhook`
3. Verify `STRIPE_WEBHOOK_SECRET` is set in Supabase secrets

### Check Webhook Logs
- Supabase Functions → `stripe-webhook` → Logs
- Look for errors or successful processing

## ✅ Success Criteria

- [ ] Stripe checkout completes
- [ ] Webhook receives `checkout.session.completed`
- [ ] Subscription created in database
- [ ] `/account/billing` shows active subscription
- [ ] "Manage Studio Access" button works (Stripe Portal)

## 🎉 You're Done!

Once the webhook processes and subscription is active, the full billing flow is complete!
