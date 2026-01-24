import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate required environment variables
function validateEnvVars() {
  const required = [
    'STRIPE_SECRET_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];
  
  const missing = required.filter(key => !Deno.env.get(key));
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Please set them in Supabase Edge Function secrets.`);
  }
}

// Validate on startup
try {
  validateEnvVars();
} catch (error) {
  console.error('Environment validation failed:', error);
  // Don't throw here - let it fail when the function is called so we get proper error response
}

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
if (!stripeSecretKey) {
  console.error('⚠️ STRIPE_SECRET_KEY is not set! Stripe operations will fail.');
}

const stripe = new Stripe(stripeSecretKey || '', {
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
    // Validate environment variables on each request
    validateEnvVars();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Use anon key for user authentication
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

    // Use service role key for database operations (bypasses RLS)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured. Please set it in Supabase Edge Function secrets.');
    }
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    // Get user profile, create if doesn't exist
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      // Profile doesn't exist, create it using admin client (bypasses RLS)
      console.log('Profile not found, creating profile for user:', user.id);
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
        })
        .select('id, email, stripe_customer_id')
        .single();

      if (createError || !newProfile) {
        console.error('Error creating profile:', createError);
        throw new Error(`Failed to create profile: ${createError?.message || 'Unknown error'}`);
      }
      profile = newProfile;
    }

    let customerId = profile.stripe_customer_id;
    
    // Create Stripe customer if doesn't exist
    if (!customerId) {
      if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY not configured. Cannot create Stripe customer.');
      }
      
      const customer = await stripe.customers.create({
        email: profile.email || user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Update profile using admin client
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    let session: Stripe.Checkout.Session;

    if (mode === 'subscription' && planId === 'studio_access') {
      // Studio Access subscription checkout
      const studioAccessPriceId = Deno.env.get('STUDIO_ACCESS_PRICE_ID');
      if (!studioAccessPriceId) {
        throw new Error('STUDIO_ACCESS_PRICE_ID not configured. Please create a $99/month recurring price in Stripe and add the Price ID to Supabase Edge Function secrets.');
      }

      if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY not configured. Cannot create checkout session.');
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

      if (!stripeSecretKey) {
        throw new Error('STRIPE_SECRET_KEY not configured. Cannot create checkout session.');
      }

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
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error('Full error details:', JSON.stringify(error, null, 2));
    
    // Provide helpful error messages for common issues
    let helpfulMessage = errorMessage;
    if (errorMessage.includes('STRIPE_SECRET_KEY') || errorMessage.includes('Missing required environment variables')) {
      helpfulMessage = `${errorMessage}\n\nPlease set all required secrets in Supabase Dashboard → Settings → Functions → Secrets`;
    } else if (errorMessage.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      helpfulMessage = `${errorMessage}\n\nGet the service role key from Supabase Dashboard → Settings → API → Service role key`;
    } else if (errorMessage.includes('STUDIO_ACCESS_PRICE_ID')) {
      helpfulMessage = `${errorMessage}\n\nCreate the price in Stripe Dashboard → Products → Add product → $99/month recurring`;
    }
    
    return new Response(
      JSON.stringify({ 
        error: helpfulMessage,
        details: error?.stack || error,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
