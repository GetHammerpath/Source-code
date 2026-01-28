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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user from auth header (optional - if not provided, charge for all users)
    const authHeader = req.headers.get("Authorization");
    let targetUserId: string | null = null;

    if (authHeader) {
      const userSupabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await userSupabase.auth.getUser();
      if (user) {
        targetUserId = user.id;
      }
    }

    console.log("🔍 Finding completed videos without credit charges...");

    // Build query - find ALL generations first, then filter for completed ones
    // This ensures we catch videos that have segments/URLs even if status isn't set correctly
    let query = supabase
      .from("kie_video_generations")
      .select("id, user_id, initial_status, extended_status, number_of_scenes, video_segments, final_video_url, initial_video_url, extended_video_url, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
    }

    const { data: allGenerations, error: genError } = await query;

    if (genError) {
      console.error("❌ Error fetching generations:", genError);
      return new Response(
        JSON.stringify({ success: false, error: genError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${allGenerations?.length || 0} total generations`);

    // Filter for completed videos:
    // 1. Has completed status
    // 2. Has final_video_url (stitched)
    // 3. Has video_segments with URLs
    // 4. Has initial_video_url or extended_video_url
    const generations = (allGenerations || []).filter((gen) => {
      const hasCompletedStatus = gen.initial_status === "completed" || gen.extended_status === "completed";
      const hasFinalVideo = !!gen.final_video_url;
      const segments = Array.isArray(gen.video_segments) ? gen.video_segments : [];
      const hasSegmentsWithUrls = segments.length > 0 && segments.some((s: any) => s.url || s.video_url);
      const hasAnyVideoUrl = !!gen.initial_video_url || !!gen.extended_video_url;
      
      return hasCompletedStatus || hasFinalVideo || hasSegmentsWithUrls || hasAnyVideoUrl;
    });

    console.log(`Filtered to ${generations.length} completed generations`);

    if (!generations || generations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No completed videos found", charged: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which ones already have debit transactions
    const { data: existingDebits, error: debitError } = await supabase
      .from("credit_transactions")
      .select("metadata")
      .eq("type", "debit");

    if (debitError) {
      console.error("❌ Error fetching transactions:", debitError);
      return new Response(
        JSON.stringify({ success: false, error: debitError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chargedGenerationIds = new Set(
      (existingDebits || [])
        .map((tx) => tx.metadata?.generation_id)
        .filter(Boolean)
    );

    const unchargedGenerations = (generations || []).filter(
      (gen) => !chargedGenerationIds.has(gen.id)
    );

    console.log(`📊 ${unchargedGenerations.length} videos need credit charging`);

    if (unchargedGenerations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "All completed videos have been charged", charged: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    // Charge credits for each uncharged generation
    for (const gen of unchargedGenerations) {
      try {
        // Calculate scenes completed - use multiple indicators
        const segments = Array.isArray(gen.video_segments) ? gen.video_segments : [];
        const hasSegments = segments.length > 0 && segments.some((s: any) => s.url || s.video_url);
        const hasInitialVideo = !!gen.initial_video_url;
        const hasExtendedVideo = !!gen.extended_video_url;
        const hasFinalVideo = !!gen.final_video_url;
        const isInitialCompleted = gen.initial_status === "completed";
        const isExtendedCompleted = gen.extended_status === "completed";
        
        // Determine scenes completed:
        // - If has final_video_url, use number_of_scenes or segments.length
        // - If has segments with URLs, count them
        // - Otherwise, count based on status flags
        let scenesCompleted = 1; // Default to 1 scene
        
        if (hasFinalVideo || hasSegments) {
          // Multi-scene video - count segments or use number_of_scenes
          scenesCompleted = Math.max(
            segments.length,
            gen.number_of_scenes || 1,
            (hasInitialVideo ? 1 : 0) + (hasExtendedVideo ? 1 : 0)
          );
        } else if (isInitialCompleted || hasInitialVideo) {
          scenesCompleted = 1;
        } else if (isExtendedCompleted || hasExtendedVideo) {
          scenesCompleted = gen.number_of_scenes || 2; // Extended means at least 2 scenes
        }
        
        // Ensure at least 1 scene
        scenesCompleted = Math.max(1, scenesCompleted);

        // Credit model: 1 segment/scene (~8s) = 1 credit
        const actualRenderedMinutes = (scenesCompleted * 8) / 60;
        const actualCredits = scenesCompleted;

        console.log(`🎬 Generation ${gen.id.substring(0, 8)}...`);
        console.log(`   Status: initial=${gen.initial_status}, extended=${gen.extended_status}`);
        console.log(`   Has videos: initial=${hasInitialVideo}, extended=${hasExtendedVideo}, final=${hasFinalVideo}`);
        console.log(`   Segments: ${segments.length}, Scenes: ${scenesCompleted}, Credits: ${actualCredits}`);

        // Get current balance
        const { data: balance, error: balanceError } = await supabase
          .from("credit_balance")
          .select("credits")
          .eq("user_id", gen.user_id)
          .single();

        if (balanceError) {
          console.error(`   ❌ Failed to get balance: ${balanceError.message}`);
          results.push({ generation_id: gen.id, success: false, error: balanceError.message });
          continue;
        }

        const currentBalance = balance?.credits || 0;
        const newBalance = Math.max(0, currentBalance - actualCredits);

        // Update credit balance
        const { error: updateError } = await supabase
          .from("credit_balance")
          .update({ credits: newBalance })
          .eq("user_id", gen.user_id);

        if (updateError) {
          console.error(`   ❌ Failed to update balance: ${updateError.message}`);
          results.push({ generation_id: gen.id, success: false, error: updateError.message });
          continue;
        }

        // Create debit transaction
        const { error: txError } = await supabase.from("credit_transactions").insert({
          user_id: gen.user_id,
          type: "debit",
          amount: -actualCredits,
          balance_after: newBalance,
          metadata: {
            generation_id: gen.id,
            actual_minutes: actualRenderedMinutes,
            scenes_completed: scenesCompleted,
            retroactive: true,
            charged_at: new Date().toISOString(),
          },
        });

        if (txError) {
          console.error(`   ❌ Failed to create transaction: ${txError.message}`);
          results.push({ generation_id: gen.id, success: false, error: txError.message });
          continue;
        }

        console.log(`   ✅ Charged ${actualCredits} credits. Balance: ${currentBalance} → ${newBalance}`);
        results.push({
          generation_id: gen.id,
          success: true,
          credits_charged: actualCredits,
          previous_balance: currentBalance,
          new_balance: newBalance,
        });
      } catch (error) {
        console.error(`   ❌ Error processing generation ${gen.id}:`, error);
        results.push({
          generation_id: gen.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const totalCredits = results.filter((r) => r.success).reduce((sum, r) => sum + (r.credits_charged || 0), 0);

    console.log(`\n✅ Retroactive credit charging complete! ${successful}/${unchargedGenerations.length} successful, ${totalCredits} total credits charged`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Charged ${totalCredits} credits for ${successful} videos`,
        charged: successful,
        total_credits: totalCredits,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in retroactively-charge-credits:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
