# Stripe Live vs Test Keys

## Current Situation

You're using **LIVE keys**:
- `sk_live_51RvAcZRYkX2b1pR7...` (Secret Key)
- `pk_live_51RvAcZRYkX2b1pR7...` (Publishable Key)

## Why Test Cards Don't Work

**Test cards only work with test keys!**

- ✅ Test keys (`sk_test_...`) + Test cards = Works
- ❌ Live keys (`sk_live_...`) + Test cards = Fails
- ✅ Live keys (`sk_live_...`) + Real cards = Works (charges real money!)

## Your Options

### Option 1: Use Test Keys (Recommended for Development)

1. Get test keys from: https://dashboard.stripe.com/test/apikeys
2. Update Supabase secrets with test keys
3. Create test products/prices in Stripe test mode
4. Use test cards: `4242 4242 4242 4242`

**Pros:**
- Safe for testing
- No real charges
- Can test failures, refunds, etc.

**Cons:**
- Need to switch to live keys for production

### Option 2: Use Live Keys with Real Card (Not Recommended)

**⚠️ WARNING: This will charge real money!**

Only do this if:
- You're ready for production
- You understand you'll be charged
- You have a real payment method

**Pros:**
- Tests real payment flow
- No switching needed

**Cons:**
- Charges real money
- Can't test failure scenarios easily
- Risk of accidental charges

## Recommendation

**Use test keys for now!**

1. Switch to test keys in Supabase
2. Create test products/prices
3. Test with test cards
4. Switch to live keys only when deploying to production

## Quick Switch

1. Go to Stripe Dashboard → Test Mode toggle (top right)
2. Copy test keys
3. Update Supabase secrets
4. Create test products/prices
5. Test with `4242 4242 4242 4242`
