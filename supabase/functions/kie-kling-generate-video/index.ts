/**
 * Kie.ai Kling 2.6 image-to-video generation.
 * Uses kling-2.6/image-to-video model via Kie.ai createTask API.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTENT_POLICY_DISCLAIMER = `
IMPORTANT DISCLAIMER:
The content is high-level, neutral, and educational in nature.
NO ON-SCREEN TEXT: NO captions, subtitles, text overlays, signs, or visible written words. Dialogue is audio only.
SCENE CONTENT:
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      user_id,
      image_url,
      prompt,
      script,
      industry,
      avatar_name,
      city,
      story_idea,
      aspect_ratio,
      watermark,
      model,
    } = body;

    if (!user_id || !image_url || !prompt) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: user_id, image_url, prompt",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Credit check (kling_2_6 = 2 credits/segment, single scene)
    const requiredCredits = 2;
    const { data: balance, error: balanceError } = await supabase
      .from("credit_balance")
      .select("credits")
      .eq("user_id", user_id)
      .single();
    if (balanceError || (balance?.credits ?? 0) < requiredCredits) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Insufficient credits. You need ${requiredCredits} credits for Kling.`,
          error_type: "CREDIT_EXHAUSTED",
          user_action: "Add more credits to continue.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const KIE_AI_TOKEN = Deno.env.get("KIE_AI_API_TOKEN") ?? Deno.env.get("KIE_API_KEY");
    if (!KIE_AI_TOKEN) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Kie.ai API key not set",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build enhanced prompt (Kling single scene - 5 or 10 sec)
    let enhancedPrompt = prompt;
    if (script) {
      enhancedPrompt = `${prompt}\n\nAVATAR DIALOGUE: "${script}"`;
    }
    const safePrompt = `${CONTENT_POLICY_DISCLAIMER}${enhancedPrompt}`;

    // Create generation record (single scene for Kling)
    const { data: generation, error: insertError } = await supabase
      .from("kie_video_generations")
      .insert({
        user_id,
        image_url,
        industry: industry || null,
        avatar_name: avatar_name || null,
        city: city || null,
        story_idea: story_idea || null,
        ai_prompt: prompt,
        scene_prompts: [{ scene_number: 1, prompt, script: script || "" }],
        number_of_scenes: 1,
        current_scene: 1,
        is_multi_scene: false,
        aspect_ratio: aspect_ratio || "16:9",
        watermark: watermark || null,
        model: model || "kling_2_6",
        initial_status: "generating",
        video_segments: [],
      })
      .select()
      .single();

    if (insertError || !generation) {
      console.error("❌ Failed to create generation record:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create generation record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/kie-callback`;

    // Kling 2.6: duration 5 or 10 seconds
    const duration = "10";

    const requestPayload = {
      model: "kling-2.6/image-to-video",
      callBackUrl: callbackUrl,
      input: {
        prompt: safePrompt,
        image_urls: [image_url],
        sound: false,
        duration: "10",
      },
    };

    // Reserve credits (create video_job)
    await supabase.from("video_jobs").insert({
      user_id,
      generation_id: generation.id,
      provider: "kie-kling",
      estimated_minutes: 10 / 60,
      estimated_credits: requiredCredits,
      credits_reserved: requiredCredits,
      status: "pending",
      metadata: { model: "kling_2_6", scene_count: 1 },
    });

    console.log("🚀 Calling Kie.ai Kling API for generation:", generation.id);

    const kieResponse = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KIE_AI_TOKEN}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error("❌ Kie.ai Kling API error:", kieResponse.status, errorText);
      await supabase
        .from("kie_video_generations")
        .update({
          initial_status: "failed",
          initial_error: `API error: ${kieResponse.status} - ${errorText}`,
        })
        .eq("id", generation.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: `Kling API error: ${errorText}`,
        }),
        { status: kieResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const kieData = await kieResponse.json();
    const data = kieData.data || kieData;
    const taskId = data.taskId || data.task_id;

    if (!taskId) {
      console.error("❌ No task ID in Kie.ai response:", kieData);
      await supabase
        .from("kie_video_generations")
        .update({
          initial_status: "failed",
          initial_error: "No task ID returned from Kling API",
        })
        .eq("id", generation.id);

      return new Response(
        JSON.stringify({ success: false, error: "No task ID returned from Kling API" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("kie_video_generations")
      .update({
        initial_task_id: taskId,
        initial_status: "generating",
      })
      .eq("id", generation.id);

    console.log("✅ Kling generation started:", generation.id, taskId);

    return new Response(
      JSON.stringify({
        success: true,
        generation_id: generation.id,
        task_id: taskId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in kie-kling-generate-video:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Kling generation failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
