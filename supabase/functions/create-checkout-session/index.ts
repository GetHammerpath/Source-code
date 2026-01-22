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

// Pricing constants (must match frontend)
const KIE_COST_PER_MINUTE = parseFloat(Deno.env.get('KIE_COST_PER_MINUTE') || '0.20');
const CREDIT_MARKUP_MULTIPLIER = parseFloat(Deno.env.get('CREDIT_MARKUP_MULTIPLIER') || '3');
const CREDITS_PER_MINUTE = parseFloat(Deno.env.get('CREDITS_PER_MINUTE') || '1');
const PRICE_PER_CREDIT = (KIE_COST_PER_MINUTE * CREDIT_MARKUP_MULTIPLIER) / CREDITS_PER_MINUTE;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const { mode, planId, credits } = body;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    let customerId = profile.stripe_customer_id;
    
    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email || user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Update profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    let session: Stripe.Checkout.Session;

    if (mode === 'subscription' && planId === 'studio_access') {
      // Studio Access subscription checkout
      const studioAccessPriceId = Deno.env.get('STUDIO_ACCESS_PRICE_ID');
      if (!studioAccessPriceId) {
        throw new Error('STUDIO_ACCESS_PRICE_ID not configured');
      }

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: studioAccessPriceId, quantity: 1 }],
        success_url: `${Deno.env.get('SITE_URL') || 'http://localhost:8080'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${Deno.env.get('SITE_URL') || 'http://localhost:8080'}/checkout/cancel`,
        metadata: {
          user_id: user.id,
          type: 'subscription',
          plan: 'studio_access',
        },
      });
    } else if (mode === 'credits' && credits) {
      // Credit purchase (dynamic pricing)
      const creditAmount = parseInt(credits);
      if (creditAmount < 1) {
        throw new Error('Credit amount must be at least 1');
      }

      const totalAmount = Math.round(creditAmount * PRICE_PER_CREDIT * 100); // Convert to cents

      session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${creditAmount.toLocaleString()} Credits`,
              description: 'Credits for video rendering (1 credit = 1 rendered minute)',
            },
            unit_amount: totalAmount, // Total in cents
          },
          quantity: 1,
        }],
        success_url: `${Deno.env.get('SITE_URL') || 'http://localhost:8080'}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${Deno.env.get('SITE_URL') || 'http://localhost:8080'}/checkout/cancel`,
        metadata: {
          user_id: user.id,
          type: 'credit_purchase',
          credits: creditAmount.toString(),
        },
      });
    } else {
      throw new Error('Invalid mode or missing planId/credits');
    }

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
