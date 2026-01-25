import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STRIPE_API = 'https://api.stripe.com/v1';

function validateEnvVars() {
  const required = ['STRIPE_SECRET_KEY', 'SERVICE_ROLE_KEY'];
  const missing = required.filter((key) => !Deno.env.get(key));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. Set them in Supabase Edge Function secrets.`);
  }
}

// Form-encode key-value pairs (Stripe format)
function formBody(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

async function stripeFetch(
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, string>
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: { message?: string } }> {
  const url = `${STRIPE_API}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const res = await fetch(url, {
    method,
    headers,
    body: body ? formBody(body) : undefined,
  });
  const text = await res.text();
  let data: Record<string, unknown> | undefined;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = undefined;
  }
  if (!res.ok) {
    const err = (data?.error as Record<string, unknown>) || {};
    return {
      ok: false,
      error: { message: (err.message as string) || text || `Stripe API ${res.status}` },
    };
  }
  return { ok: true, data: data as Record<string, unknown> };
}

// Pricing (match frontend / Edge Function defaults)
const KIE_COST_PER_MINUTE = parseFloat(Deno.env.get('KIE_COST_PER_MINUTE') || '0.20');
const CREDIT_MARKUP_MULTIPLIER = parseFloat(Deno.env.get('CREDIT_MARKUP_MULTIPLIER') || '3');
const CREDITS_PER_MINUTE = parseFloat(Deno.env.get('CREDITS_PER_MINUTE') || '1');
const PRICE_PER_CREDIT = (KIE_COST_PER_MINUTE * CREDIT_MARKUP_MULTIPLIER) / CREDITS_PER_MINUTE;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    validateEnvVars();
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:8080';

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

    const body = (await req.json()) as { mode?: string; planId?: string; credits?: number };
    const { mode, planId, credits } = body;

    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      throw new Error('SERVICE_ROLE_KEY not configured. Set it in Supabase Edge Function secrets (Settings → API → Service role key).');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey
    );

    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '',
        })
        .select('id, email, stripe_customer_id')
        .single();

      if (createError || !newProfile) {
        throw new Error(`Failed to create profile: ${createError?.message || 'Unknown error'}`);
      }
      profile = newProfile;
    }

    let customerId = profile.stripe_customer_id as string | null;

    if (!customerId) {
      const customerRes = await stripeFetch(stripeSecretKey, 'POST', '/customers', {
        email: profile.email || (user.email as string) || '',
        'metadata[supabase_user_id]': user.id,
      });
      if (!customerRes.ok || !customerRes.data) {
        throw new Error(customerRes.error?.message || 'Failed to create Stripe customer');
      }
      customerId = (customerRes.data.id as string) || null;
      if (!customerId) throw new Error('Stripe customer created but no id returned');

      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    let sessionId: string;
    let sessionUrl: string | null;

    if (mode === 'subscription' && planId === 'studio_access') {
      const studioAccessPriceId = Deno.env.get('STUDIO_ACCESS_PRICE_ID');
      if (!studioAccessPriceId) {
        throw new Error('STUDIO_ACCESS_PRICE_ID not configured. Create a $99/month recurring price in Stripe and add the Price ID to Supabase secrets.');
      }

      const sessionRes = await stripeFetch(stripeSecretKey, 'POST', '/checkout/sessions', {
        customer: customerId!,
        mode: 'subscription',
        'line_items[0][price]': studioAccessPriceId,
        'line_items[0][quantity]': '1',
        success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/checkout/cancel`,
        'metadata[user_id]': user.id,
        'metadata[type]': 'subscription',
        'metadata[plan]': 'studio_access',
      });

      if (!sessionRes.ok || !sessionRes.data) {
        throw new Error(sessionRes.error?.message || 'Failed to create Stripe checkout session');
      }
      sessionId = sessionRes.data.id as string;
      sessionUrl = (sessionRes.data.url as string) || null;
    } else if (mode === 'credits' && credits) {
      const creditAmount = Math.max(1, parseInt(String(credits), 10));
      const totalCents = Math.round(creditAmount * PRICE_PER_CREDIT * 100);
      const productName = `${creditAmount.toLocaleString()} Credits`;
      const productDesc = 'Credits for video rendering (1 credit = 1 rendered minute)';

      const sessionRes = await stripeFetch(stripeSecretKey, 'POST', '/checkout/sessions', {
        customer: customerId!,
        mode: 'payment',
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][product_data][name]': productName,
        'line_items[0][price_data][product_data][description]': productDesc,
        'line_items[0][price_data][unit_amount]': String(totalCents),
        'line_items[0][quantity]': '1',
        success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/checkout/cancel`,
        'metadata[user_id]': user.id,
        'metadata[type]': 'credit_purchase',
        'metadata[credits]': String(creditAmount),
      });

      if (!sessionRes.ok || !sessionRes.data) {
        throw new Error(sessionRes.error?.message || 'Failed to create Stripe checkout session');
      }
      sessionId = sessionRes.data.id as string;
      sessionUrl = (sessionRes.data.url as string) || null;
    } else {
      throw new Error('Invalid mode or missing planId/credits');
    }

    if (!sessionUrl) {
      throw new Error('Stripe checkout session created but no URL returned');
    }

    return new Response(
      JSON.stringify({ sessionId, url: sessionUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('create-checkout-session error:', errorMessage);

    let helpful = errorMessage;
    if (errorMessage.includes('STRIPE_SECRET_KEY') || errorMessage.includes('Missing required')) {
      helpful = `${errorMessage}\n\nSet secrets in Supabase Dashboard → Settings → Edge Functions → Secrets`;
    } else if (errorMessage.includes('SERVICE_ROLE_KEY')) {
      helpful = `${errorMessage}\n\nUse Supabase Dashboard → Settings → API → Service role key`;
    } else if (errorMessage.includes('STUDIO_ACCESS_PRICE_ID')) {
      helpful = `${errorMessage}\n\nCreate a $99/month recurring price in Stripe, then add its Price ID to secrets`;
    }

    return new Response(
      JSON.stringify({
        error: helpful,
        details: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
