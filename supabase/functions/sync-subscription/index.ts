import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceId = Deno.env.get("STUDIO_ACCESS_PRICE_ID");

    if (!serviceRoleKey || !stripeSecretKey || !priceId) {
      throw new Error("Sync not configured (STRIPE_SECRET_KEY, STUDIO_ACCESS_PRICE_ID, service role)");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ synced: false, reason: "no_customer_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-11-20.acacia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const subs = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
      limit: 20,
    });

    const active = subs.data.find(
      (s) =>
        (s.status === "active" || s.status === "trialing") &&
        (s.items.data[0]?.price?.id === priceId ||
          (s.items.data[0]?.price?.metadata?.plan as string) === "studio_access" ||
          (s.metadata?.plan as string) === "studio_access" ||
          (s.metadata?.user_id as string) === user.id)
    );
    const fallback = !active && subs.data.length > 0
      ? subs.data.find((s) => s.status === "active" || s.status === "trialing")
      : null;
    const sub = active ?? fallback;

    if (!sub) {
      return new Response(
        JSON.stringify({ synced: false, reason: "no_active_studio_subscription" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const status =
      sub.status === "active" || sub.status === "trialing"
        ? "active"
        : sub.status === "past_due"
          ? "past_due"
          : sub.status === "unpaid"
            ? "unpaid"
            : "canceled";

    const { error: upsertError } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: user.id,
        plan: "studio_access",
        status,
        stripe_subscription_id: sub.id,
        stripe_customer_id: profile.stripe_customer_id,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
      },
      { onConflict: "user_id,status" }
    );

    if (upsertError) {
      console.error("Sync upsert error:", upsertError);
      throw new Error(upsertError.message);
    }

    return new Response(
      JSON.stringify({ synced: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("sync-subscription error:", err);
    const msg = err instanceof Error ? err.message : "Sync failed";
    return new Response(
      JSON.stringify({ error: msg, synced: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
