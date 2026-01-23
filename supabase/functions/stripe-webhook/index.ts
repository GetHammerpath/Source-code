import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-11-20.acacia',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const eventId = event.id;
    const eventType = event.type;
    console.log(`Processing webhook event: ${eventType} (${eventId})`);

    const { data: existing } = await supabase
      .from('stripe_event_log')
      .select('id')
      .eq('stripe_event_id', eventId)
      .maybeSingle();

    if (existing) {
      console.log(`Event ${eventId} already processed (idempotent)`);
      return new Response(
        JSON.stringify({ received: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      switch (eventType) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(supabase, session);
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionCreatedOrUpdated(supabase, subscription);
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(supabase, subscription);
          break;
        }
        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaid(supabase, invoice);
          break;
        }
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaymentFailed(supabase, invoice);
          break;
        }
        default:
          console.log(`Unhandled event type: ${eventType}`);
      }

      await supabase.from('stripe_event_log').insert({
        stripe_event_id: eventId,
        event_type: eventType,
        status: 'success',
        metadata: { type: eventType },
      });
    } catch (handlerErr: unknown) {
      const errMsg = handlerErr instanceof Error ? handlerErr.message : String(handlerErr);
      await supabase.from('stripe_event_log').insert({
        stripe_event_id: eventId,
        event_type: eventType,
        status: 'failed',
        error_message: errMsg,
        metadata: { type: eventType },
      });
      throw handlerErr;
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Webhook error:', error);
    const msg = error instanceof Error ? error.message : 'Webhook processing failed';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Handle checkout session completed (credit purchases or subscriptions)
async function handleCheckoutSessionCompleted(
  supabase: any,
  session: Stripe.Checkout.Session
) {
  const customerId = session.customer as string;
  const metadata = session.metadata || {};
  const userId = metadata.user_id;

  // Check if this is a credit purchase
  if (metadata.type === 'credit_purchase') {
    const credits = parseInt(metadata.credits || '0');

    if (!userId || credits <= 0) {
      console.error('Missing userId or invalid credits in checkout metadata');
      return;
    }

    // Grant credits (idempotent check via stripe_event_id)
    await grantCredits(supabase, userId, credits, 'purchase', {
      stripe_event_id: session.id,
      stripe_payment_intent_id: session.payment_intent as string,
      credits: credits.toString(),
    });

    console.log(`Granted ${credits} credits to user ${userId}`);
  }

  // If customer doesn't have stripe_customer_id yet, update profile
  if (customerId && userId) {
    const { error } = await supabase
      .from('profiles')
      .update({ stripe_customer_id: customerId })
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile with stripe_customer_id:', error);
    }
  }
}

// Handle subscription created/updated (Studio Access only)
async function handleSubscriptionCreatedOrUpdated(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const planId = subscription.items.data[0]?.price.metadata?.plan || 
                 subscription.metadata?.plan || 'studio_access';

  // Only support studio_access plan
  const plan = planId === 'studio_access' ? 'studio_access' : 'studio_access';

  // Get user by stripe_customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) {
    console.error(`User not found for customer ${customerId}`);
    return;
  }

  const userId = profile.id;
  const status = subscription.status === 'active' || subscription.status === 'trialing' 
    ? 'active' 
    : subscription.status === 'past_due' 
    ? 'past_due' 
    : subscription.status === 'unpaid'
    ? 'unpaid'
    : 'canceled';

  // Upsert subscription
  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan,
      status,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customerId,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    }, {
      onConflict: 'user_id,status',
    });

  if (subError) {
    console.error('Error upserting subscription:', subError);
  }

  console.log(`Updated Studio Access subscription for user ${userId}: ${status}`);
}

// Handle subscription deleted
async function handleSubscriptionDeleted(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const subscriptionId = subscription.id;

  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('Error updating subscription status:', error);
  }
}

// Handle invoice paid (Studio Access renewal - no credits granted)
async function handleInvoicePaid(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const subscriptionId = invoice.subscription as string;
  
  if (!subscriptionId) {
    // Not a subscription invoice
    return;
  }

  // Studio Access includes 0 credits - no action needed
  // Just log the renewal
  console.log(`Studio Access invoice paid for subscription ${subscriptionId}`);
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const subscriptionId = invoice.subscription as string;
  
  if (!subscriptionId) {
    return;
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    console.error('Error updating subscription to past_due:', error);
  }
}

// Helper: Grant credits (idempotent)
async function grantCredits(
  supabase: any,
  userId: string,
  credits: number,
  type: 'purchase' | 'grant',
  metadata: {
    stripe_event_id?: string;
    stripe_invoice_id?: string;
    stripe_payment_intent_id?: string;
    pack_id?: string;
    reason?: string;
  }
) {
  // Check idempotency if stripe_event_id provided
  if (metadata.stripe_event_id) {
    const { data: existing } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('stripe_event_id', metadata.stripe_event_id)
      .single();

    if (existing) {
      console.log(`Transaction already processed for event ${metadata.stripe_event_id}`);
      return;
    }
  }

  // Get current balance
  const { data: balance } = await supabase
    .from('credit_balance')
    .select('credits')
    .eq('user_id', userId)
    .single();

  const currentBalance = balance?.credits || 0;
  const newBalance = currentBalance + credits;

  // Update credit balance
  const { error: balanceError } = await supabase
    .from('credit_balance')
    .upsert({
      user_id: userId,
      credits: newBalance,
    }, {
      onConflict: 'user_id',
    });

  if (balanceError) {
    console.error('Error updating credit balance:', balanceError);
    throw balanceError;
  }

  // Create transaction record
  const { error: txError } = await supabase
    .from('credit_transactions')
    .insert({
      user_id: userId,
      type,
      amount: credits,
      balance_after: newBalance,
      stripe_event_id: metadata.stripe_event_id,
      stripe_invoice_id: metadata.stripe_invoice_id,
      stripe_payment_intent_id: metadata.stripe_payment_intent_id,
      metadata,
    });

  if (txError) {
    console.error('Error creating credit transaction:', txError);
    throw txError;
  }
}
