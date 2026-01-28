# Welcome to your Hammerpath Video Generator Portal

## Billing & Credits System

This app includes a full Stripe integration with a credits-based payment system. See [BILLING_SETUP.md](./BILLING_SETUP.md) for complete setup instructions.

### Quick Start

1. **Set up Stripe**: Create products, prices, and webhook endpoint (see BILLING_SETUP.md)
2. **Configure environment variables**: Add Stripe keys and price IDs
3. **Run database migrations**: `supabase migration up`
4. **Deploy Edge Functions**: Deploy `stripe-webhook`, `create-checkout-session`, `create-portal-session`

### Key Features

- **Studio Access**: $99/month subscription (unlocks studio features - includes 0 credits)
- **Credits**: Pay-as-you-go credit purchases (1 credit ≈ 1 segment / ~8 seconds)
- **Credit Gating**: Automatic credit checks before video generation
- **Billing Management**: Full Stripe Customer Portal integration
- **Transaction Ledger**: Complete history of credit purchases and usage

### Pages

- `/pricing` - View Studio Access subscription + credit pricing
- `/checkout` - Secure Stripe checkout (access subscription or credit purchase)
- `/account/billing` - Manage Studio Access subscription and view credit balance
- `/checkout/success` - Post-purchase confirmation
- `/checkout/cancel` - Cancelled checkout page

### Business Model

1. **Studio Access** - Monthly subscription ($99/month) that unlocks:
   - Studio & orchestration UI
   - Provider integrations framework
   - Team collaboration tools
   - Compliance tooling
   - **Includes 0 credits** - Credits are purchased separately

2. **Credits** - Pay-as-you-go usage:
   - 1 credit ≈ 1 segment (~8 seconds)
   - Credits do not expire
   - Price per credit: configurable (defaults to ~$3.34)
   - Buy any quantity you need

### Credit Flow

1. User initiates video generation → Credit check
2. Insufficient credits → Redirect to buy credits
3. Sufficient credits → Reserve credits → Start generation
4. On completion → Charge credits
5. On failure → Refund credits