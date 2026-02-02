import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { batch_id } = (await req.json()) as { batch_id: string };
    if (!batch_id) {
      throw new Error("batch_id is required");
    }

    // Verify batch exists and user owns it (when JWT present)
    const { data: batch, error: batchErr } = await supabase
      .from("bulk_video_batches")
      .select("id, user_id")
      .eq("id", batch_id)
      .single();
    if (batchErr || !batch) {
      return new Response(
        JSON.stringify({ error: "Batch not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { createClient: createSupabase } = await import("https://esm.sh/@supabase/supabase-js@2");
      const anon = createSupabase(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anon.auth.getUser();
      if (user && batch.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Not authorized to retry this batch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get generation IDs linked to this batch
    const { data: batchGens, error: linkError } = await supabase
      .from("bulk_batch_generations")
      .select("generation_id")
      .eq("batch_id", batch_id);

    if (linkError || !batchGens?.length) {
      throw new Error(`No generations found for batch: ${linkError?.message || "empty"}`);
    }

    const genIds = batchGens.map((r) => r.generation_id);

    // Find failed generations (initial_status or final_video_status = 'failed')
    const { data: failedGens, error: fetchError } = await supabase
      .from("kie_video_generations")
      .select("id, ai_prompt, scene_prompts, image_url, model, aspect_ratio, watermark, avatar_name, industry, script, metadata")
      .in("id", genIds)
      .or("initial_status.eq.failed,final_video_status.eq.failed");

    if (fetchError) {
      throw new Error(`Failed to fetch generations: ${fetchError.message}`);
    }

    const toRetry = failedGens || [];
    if (toRetry.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No failed generations to retry",
          batch_id,
          retried: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Retrying ${toRetry.length} failed generations for batch ${batch_id}`);

    let successCount = 0;
    let failCount = 0;

    for (const gen of toRetry) {
      try {
        const generationType = (gen.metadata as { generation_type?: string })?.generation_type || "REFERENCE_2_VIDEO";
        const isTextMode = generationType === "TEXT_2_VIDEO" || gen.image_url === "text-only-mode";

        // Reset status to pending
        const { error: updateError } = await supabase
          .from("kie_video_generations")
          .update({
            initial_status: "pending",
            initial_error: null,
            initial_task_id: null,
            initial_completed_at: null,
            initial_video_url: null,
            final_video_status: null,
            final_video_error: null,
            final_video_url: null,
          })
          .eq("id", gen.id);

        if (updateError) {
          console.error(`❌ Failed to reset generation ${gen.id}:`, updateError);
          failCount++;
          continue;
        }

        const scenePrompts = gen.scene_prompts as Array<{ prompt?: string; script?: string }> | undefined;
        const firstScene = Array.isArray(scenePrompts) ? scenePrompts[0] : null;
        const prompt = firstScene?.prompt || gen.ai_prompt || "";
        const script = firstScene?.script || gen.script || "";
        const enhancedPrompt = script ? `${prompt}\n\nAVATAR DIALOGUE: "${script}"` : prompt;

        // Re-trigger kie-generate-video
        const generateResponse = await fetch(`${supabaseUrl}/functions/v1/video-generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            generation_id: gen.id,
            prompt: enhancedPrompt,
            image_url: isTextMode ? null : gen.image_url,
            model: gen.model || "veo3_fast",
            aspect_ratio: gen.aspect_ratio || "16:9",
            watermark: gen.watermark || "",
            avatar_name: gen.avatar_name,
            industry: gen.industry,
            script: script,
            generation_type: generationType,
          }),
        });

        if (!generateResponse.ok) {
          const errText = await generateResponse.text();
          console.error(`❌ kie-generate-video failed for ${gen.id}:`, errText);
          await supabase
            .from("kie_video_generations")
            .update({
              initial_status: "failed",
              initial_error: `Retry failed: ${errText}`,
            })
            .eq("id", gen.id);
          failCount++;
          continue;
        }

        const genData = await generateResponse.json();
        if (genData.success) {
          console.log(`✅ Retry triggered for generation ${gen.id}`);
          successCount++;
        } else {
          await supabase
            .from("kie_video_generations")
            .update({
              initial_status: "failed",
              initial_error: genData.error || "Retry failed",
            })
            .eq("id", gen.id);
          failCount++;
        }

        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        console.error(`❌ Retry failed for generation ${gen.id}:`, err);
        failCount++;
      }
    }

    console.log(`🏁 Retry complete. Succeeded: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Retried ${successCount} generations, ${failCount} failed`,
        batch_id,
        retried: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("❌ Error in retry-failed-generations:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
