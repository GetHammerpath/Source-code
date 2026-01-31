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

function isTestLiveCustomerMismatch(err: { message?: string } | null): boolean {
  const m = err?.message ?? '';
  return (
    /similar object exists in live mode.*test mode key/i.test(m) ||
    /test mode key.*similar object exists in live mode/i.test(m) ||
    (/No such customer/i.test(m) && /test mode key|live mode/i.test(m))
  );
}

// Pricing (match frontend / Edge Function defaults)
const KIE_COST_PER_MINUTE = parseFloat(Deno.env.get('KIE_COST_PER_MINUTE') || '0.20');
const CREDIT_MARKUP_MULTIPLIER = parseFloat(Deno.env.get('CREDIT_MARKUP_MULTIPLIER') || '3');
const CREDITS_PER_MINUTE = parseFloat(Deno.env.get('CREDITS_PER_MINUTE') || '1');
const PRICE_PER_CREDIT = (KIE_COST_PER_MINUTE * CREDIT_MARKUP_MULTIPLIER) / CREDITS_PER_MINUTE;

function getSiteUrl(req: Request): string {
  const fromEnv = Deno.env.get('SITE_URL');
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const origin = req.headers.get('Origin') || req.headers.get('Referer');
  if (origin) {
    try {
      const u = new URL(origin);
      return `${u.protocol}//${u.host}`;
    } catch {
      /**/
    }
  }
  return 'http://localhost:8080';
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (req.method === 'GET') {
      const stripe = !!Deno.env.get('STRIPE_SECRET_KEY');
      const serviceRole = !!Deno.env.get('SERVICE_ROLE_KEY');
      const priceId = !!Deno.env.get('STUDIO_ACCESS_PRICE_ID');
      const siteUrl = !!Deno.env.get('SITE_URL');
      return new Response(
        JSON.stringify({
          ok: true,
          env: { stripe, serviceRole, priceId, siteUrl },
          hint: !stripe || !serviceRole || !priceId
            ? 'Set STRIPE_SECRET_KEY, SERVICE_ROLE_KEY, STUDIO_ACCESS_PRICE_ID in Supabase Edge Function secrets.'
            : undefined,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      validateEnvVars();
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
    const siteUrl = getSiteUrl(req);

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

    let body: { mode?: string; planId?: string; credits?: number };
    try {
      body = (await req.json()) as { mode?: string; planId?: string; credits?: number };
    } catch {
      throw new Error('Invalid JSON body. Send { mode, planId } for subscription or { mode, credits } for credits.');
    }
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

    let sessionId = '';
    let sessionUrl: string | null = null;

    const createSession = async (custId: string) => {
      if (mode === 'subscription' && planId === 'studio_access') {
        const studioAccessPriceId = Deno.env.get('STUDIO_ACCESS_PRICE_ID');
        if (!studioAccessPriceId) {
          throw new Error('STUDIO_ACCESS_PRICE_ID not configured. Create a $99/month recurring price in Stripe and add the Price ID to Supabase secrets.');
        }
        return stripeFetch(stripeSecretKey, 'POST', '/checkout/sessions', {
          customer: custId,
          mode: 'subscription',
          'line_items[0][price]': studioAccessPriceId,
          'line_items[0][quantity]': '1',
          success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/checkout/cancel`,
          'metadata[user_id]': user.id,
          'metadata[type]': 'subscription',
          'metadata[plan]': 'studio_access',
        });
      }
      if (mode === 'credits' && credits) {
        const rawCredits = parseInt(String(credits), 10);
        if (rawCredits < 30) throw new Error('Minimum purchase is 30 credits');
        const creditAmount = rawCredits;
        const totalCents = Math.round(creditAmount * PRICE_PER_CREDIT * 100);
        const productName = `${creditAmount.toLocaleString()} Credits`;
        const productDesc = 'Credits for video rendering (1 credit = 1 rendered minute)';
        return stripeFetch(stripeSecretKey, 'POST', '/checkout/sessions', {
          customer: custId,
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
      }
      throw new Error('Invalid mode or missing planId/credits');
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      const sessionRes = await createSession(customerId!);

      if (sessionRes.ok && sessionRes.data) {
        sessionId = sessionRes.data.id as string;
        sessionUrl = (sessionRes.data.url as string) || null;
        break;
      }

      if (isTestLiveCustomerMismatch(sessionRes.error) && attempt === 0) {
        await supabaseAdmin.from('profiles').update({ stripe_customer_id: null }).eq('id', user.id);
        const customerRes = await stripeFetch(stripeSecretKey, 'POST', '/customers', {
          email: profile.email || (user.email as string) || '',
          'metadata[supabase_user_id]': user.id,
        });
        if (!customerRes.ok || !customerRes.data) {
          throw new Error(customerRes.error?.message || 'Failed to create Stripe customer (retry after test/live mismatch)');
        }
        customerId = (customerRes.data.id as string) || null;
        if (!customerId) throw new Error('Stripe customer created but no id returned');
        await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
        continue;
      }

      throw new Error(sessionRes.error?.message || 'Failed to create Stripe checkout session');
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
    } else if (/price.*recurring|This price is not recurring|invalid.*price/i.test(errorMessage)) {
      helpful = `${errorMessage}\n\nStudio Access requires a recurring ($/month) price in Stripe. Create one and set STUDIO_ACCESS_PRICE_ID to that Price ID.`;
    } else if (/No such customer|test mode.*live mode|live mode.*test mode/i.test(errorMessage)) {
      helpful = `${errorMessage}\n\nThe stored Stripe customer was from a different mode (test vs live). This should auto-retry; if it persists, clear stripe_customer_id for your user in profiles and try again.`;
    }

    const details = err instanceof Error ? err.stack : undefined;
    const body = JSON.stringify({
      error: helpful,
      details: details ? String(details).slice(0, 2000) : undefined,
      timestamp: new Date().toISOString(),
    });

    return new Response(body, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  } catch (outer: unknown) {
    const msg = outer instanceof Error ? outer.message : String(outer);
    console.error('create-checkout-session unexpected:', msg);
    return new Response(
      JSON.stringify({
        error: `Unexpected error: ${msg}`,
        details: undefined,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
