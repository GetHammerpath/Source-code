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

    // Check if user is admin
    const { data: roles, error: roleError } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roles) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let body: { user_id?: string; user_email?: string; generation_id?: string; amount?: number; reason?: string } = {};
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Resolve user_id from email if provided
    let targetUserId = body.user_id;
    if (!targetUserId && body.user_email) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from("auth.users")
        .select("id")
        .eq("email", body.user_email)
        .single();

      if (userError || !userData) {
        return new Response(
          JSON.stringify({ success: false, error: `User not found: ${body.user_email}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      targetUserId = userData.id;
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id or user_email required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If generation_id is provided, charge for that specific generation
    if (body.generation_id) {
      const { data: generation, error: genError } = await supabaseAdmin
        .from("kie_video_generations")
        .select("id, user_id, number_of_scenes, video_segments")
        .eq("id", body.generation_id)
        .single();

      if (genError || !generation) {
        return new Response(
          JSON.stringify({ success: false, error: `Generation not found: ${body.generation_id}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (generation.user_id !== targetUserId) {
        return new Response(
          JSON.stringify({ success: false, error: "Generation does not belong to specified user" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Credit model: 1 segment/scene (~8s) = 1 credit
      const segments = Array.isArray(generation.video_segments) ? generation.video_segments : [];
      const scenesCompleted = Math.max(segments.length, generation.number_of_scenes || 1, 1);
      const actualRenderedMinutes = (scenesCompleted * 8) / 60;
      const actualCredits = scenesCompleted;

      // Get current balance
      const { data: balance, error: balanceError } = await supabaseAdmin
        .from("credit_balance")
        .select("credits")
        .eq("user_id", targetUserId)
        .single();

      if (balanceError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to get balance: ${balanceError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const currentBalance = balance?.credits || 0;
      const newBalance = Math.max(0, currentBalance - actualCredits);

      // Update credit balance
      const { error: updateError } = await supabaseAdmin
        .from("credit_balance")
        .update({ credits: newBalance })
        .eq("user_id", targetUserId);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to update balance: ${updateError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create debit transaction
      const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
        user_id: targetUserId,
        type: "debit",
        amount: -actualCredits,
        balance_after: newBalance,
        metadata: {
          generation_id: body.generation_id,
          actual_minutes: actualRenderedMinutes,
          scenes_completed: scenesCompleted,
          charged_by: "admin",
          admin_user_id: user.id,
          reason: body.reason || "Admin charge for video generation",
        },
      });

      if (txError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to create transaction: ${txError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Charged ${actualCredits} credits for generation`,
          credits_charged: actualCredits,
          previous_balance: currentBalance,
          new_balance: newBalance,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Otherwise, charge a specific amount
    const amount = typeof body.amount === "number" ? Math.floor(body.amount) : parseInt(String(body?.amount ?? ""), 10);

    if (isNaN(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Amount must be a positive number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current balance
    const { data: balance, error: balanceError } = await supabaseAdmin
      .from("credit_balance")
      .select("credits")
      .eq("user_id", targetUserId)
      .single();

    if (balanceError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to get balance: ${balanceError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentBalance = balance?.credits || 0;
    const newBalance = Math.max(0, currentBalance - amount);

    // Update credit balance
    const { error: updateError } = await supabaseAdmin
      .from("credit_balance")
      .update({ credits: newBalance })
      .eq("user_id", targetUserId);

    if (updateError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to update balance: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create debit transaction
    const { error: txError } = await supabaseAdmin.from("credit_transactions").insert({
      user_id: targetUserId,
      type: "debit",
      amount: -amount,
      balance_after: newBalance,
      metadata: {
        charged_by: "admin",
        admin_user_id: user.id,
        reason: body.reason || "Admin credit deduction",
      },
    });

    if (txError) {
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create transaction: ${txError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Charged ${amount} credits`,
        credits_charged: amount,
        previous_balance: currentBalance,
        new_balance: newBalance,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in admin-charge-credits:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
