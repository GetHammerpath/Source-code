import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: { amount?: number; reason?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amount = typeof body.amount === "number" ? Math.floor(body.amount) : parseInt(String(body?.amount ?? ""), 10);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Amount must be a positive number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: row, error: fetchError } = await supabaseAdmin
      .from("credit_balance")
      .select("credits")
      .eq("user_id", user.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("deduct-kie-credits fetch balance:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch balance" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentCredits = row?.credits ?? 0;
    if (currentCredits < amount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Insufficient credits. You have ${currentCredits} and tried to deduct ${amount}.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newBalance = currentCredits - amount;

    const { error: updateError } = await supabaseAdmin
      .from("credit_balance")
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("deduct-kie-credits update balance:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update balance" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
      user_id: user.id,
      type: "debit",
      amount: -amount,
      balance_after: newBalance,
      metadata: {
        reason: reason || "Kie credits deduction",
        source: "kie_usage",
        deducted_by: "user",
      },
    });

    if (txError) {
      console.error("deduct-kie-credits insert transaction:", txError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to record transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        deducted: amount,
        previous_balance: currentCredits,
        new_balance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("deduct-kie-credits:", e);
    const msg = e instanceof Error ? e.message : "Failed to deduct credits";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
