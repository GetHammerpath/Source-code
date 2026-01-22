# Billing & Credits System Setup Guide

This document explains how to set up and configure the Stripe payment and credits system.

## Overview

The app uses a simple two-product model:
- **Studio Access**: $99/month subscription (unlocks studio features - includes 0 credits)
- **Credits**: Pay-as-you-go credit purchases (1 credit = 1 rendered minute)

No plans, tiers, or included usage. Access and usage are separate products.

## Configuration

### Environment Variables

Add these to your `.env` file (or Supabase Edge Function secrets):

#### Stripe Keys
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=http://localhost:8080  # Your site URL for checkout redirects
```

#### Stripe Price IDs
```env
STUDIO_ACCESS_PRICE_ID=price_...  # Studio Access subscription price
```

#### Pricing Configuration
```env
VITE_KIE_COST_PER_MINUTE=0.20  # Base cost from Kie.ai (default: 0.20)
VITE_CREDIT_MARKUP_MULTIPLIER=3  # Margin multiplier (default: 3)
VITE_CREDITS_PER_MINUTE=1  # Credits per rendered minute (default: 1)
```

**Formula**: `PRICE_PER_CREDIT = (KIE_COST_PER_MINUTE × CREDIT_MARKUP_MULTIPLIER) / CREDITS_PER_MINUTE`
- Default: `(0.20 × 3) / 1 = $0.60 per credit`

### Pricing Configuration

Edit `src/lib/billing/pricing.ts` to adjust:
- Studio Access price (currently $99/month)
- Kie.ai cost per minute (default: $0.20)
- Credit markup multiplier (default: 3)
- Credits per minute (default: 1)

## Stripe Setup

### 1. Create Products and Prices in Stripe Dashboard

#### Studio Access Subscription (Monthly Recurring)

1. **Studio Access**
   - Product: "Studio Access"
   - Price: $99/month recurring
   - Metadata: `plan: studio_access`
   - Copy Price ID → `STUDIO_ACCESS_PRICE_ID`

#### Credit Purchases (Dynamic Pricing)

Credits are purchased using dynamic pricing via Stripe Checkout's `price_data`. No need to create predefined price objects. The system calculates the total based on:
- Number of credits requested
- PRICE_PER_CREDIT (from pricing formula)

### 2. Configure Webhooks

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

### 3. Set Up Supabase Edge Function Secrets

```bash
# Navigate to your Supabase project
cd supabase

# Set secrets for Edge Functions
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STUDIO_ACCESS_PRICE_ID=price_...
supabase secrets set SITE_URL=https://your-domain.com
supabase secrets set KIE_COST_PER_MINUTE=0.20
supabase secrets set CREDIT_MARKUP_MULTIPLIER=3
supabase secrets set CREDITS_PER_MINUTE=1
```

## Database Setup

### Run Migrations

The billing tables are created by migrations:
```bash
supabase migration up
```

This creates:
- `subscriptions` - Studio Access subscription records
- `credit_balance` - Current credit balance per user
- `credit_transactions` - Credit transaction ledger
- `video_jobs` - Video generation jobs with credit tracking

### RLS Policies

The migrations include RLS policies so users can only see their own:
- Subscriptions
- Credit balances
- Credit transactions
- Video jobs

## Local Webhook Testing

### Using Stripe CLI

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli

2. Login:
```bash
stripe login
```

3. Forward webhooks to local:
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

4. Trigger test events:
```bash
# Test Studio Access subscription
stripe trigger customer.subscription.created

# Test credit purchase (checkout.session.completed)
stripe trigger checkout.session.completed

# Test invoice paid (Studio Access renewal - no credits granted)
stripe trigger invoice.paid
```

### Test Cards

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires 3D Secure: `4000 0025 0000 3155`

## Credit Flow

### Generation Flow

1. **User initiates generation** → Check credits via `checkCredits()`
2. **If sufficient** → Reserve credits via `reserveCredits()` (creates `video_jobs` record)
3. **On completion** → Charge credits via `chargeCredits()` (deducts from balance)
4. **On failure** → Refund credits via `refundCredits()` (releases reserved credits)

### Studio Access Flow

1. **User subscribes** → Stripe Checkout Session created
2. **Payment succeeds** → Webhook receives `checkout.session.completed`
3. **Subscription created** → Webhook receives `customer.subscription.created`
4. **Monthly renewal** → Webhook receives `invoice.paid` (no credits granted - Studio Access includes 0 credits)

### Credit Purchase Flow

1. **User buys credits** → Stripe Checkout Session created with dynamic pricing
2. **Payment succeeds** → Webhook receives `checkout.session.completed`
3. **Credits granted** → Immediately added to balance (idempotent via `stripe_event_id`)

## Idempotency

All credit grants use Stripe event IDs to ensure idempotency:
- Check `credit_transactions` for existing `stripe_event_id` before granting
- Prevents double-granting on webhook retries

## Adjusting Pricing

Edit these in `src/lib/billing/pricing.ts` or via environment variables:

```typescript
// Base cost from Kie.ai
export const KIE_COST_PER_MINUTE = parseFloat(
  import.meta.env.VITE_KIE_COST_PER_MINUTE || "0.20"
);

// Margin multiplier
export const CREDIT_MARKUP_MULTIPLIER = parseFloat(
  import.meta.env.VITE_CREDIT_MARKUP_MULTIPLIER || "3"
);

// Credits per rendered minute
export const CREDITS_PER_MINUTE = parseFloat(
  import.meta.env.VITE_CREDITS_PER_MINUTE || "1"
);

// Price per credit (calculated)
export const PRICE_PER_CREDIT = (KIE_COST_PER_MINUTE * CREDIT_MARKUP_MULTIPLIER) / CREDITS_PER_MINUTE;
```

## Troubleshooting

### Credits not granted after purchase
- Check webhook logs in Stripe Dashboard
- Verify webhook signature secret matches
- Check Supabase Edge Function logs
- Ensure `stripe_customer_id` is set on user profile

### Studio Access not activated
- Verify `STUDIO_ACCESS_PRICE_ID` is correct
- Check subscription status in Stripe Dashboard
- Verify webhook is receiving `customer.subscription.created` events

### Credit check fails
- Ensure user has `credit_balance` record (auto-created)
- Check RLS policies allow user to read own balance
- Verify credits haven't been double-spent

## Support

For issues:
1. Check Stripe Dashboard → Logs for payment events
2. Check Supabase Dashboard → Edge Functions → Logs for webhook errors
3. Review browser console for frontend errors
4. Check database for transaction records
