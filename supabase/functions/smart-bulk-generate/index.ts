import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VariableCombination {
  [key: string]: string;
}

interface BaseConfig {
  image_url: string | null;
  generation_type: string;
  industry: string;
  city: string;
  story_idea?: string;
  model: string;
  aspect_ratio: string;
  number_of_scenes: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { batch_id, combinations, base_config } = await req.json() as {
      batch_id: string;
      combinations: VariableCombination[];
      base_config: BaseConfig;
    };

    const isTextOnlyMode = base_config.generation_type === "TEXT_2_VIDEO" || !base_config.image_url;
    console.log(`🚀 [Smart Bulk] Starting generation for batch ${batch_id} with ${combinations.length} user-selected variations`);
    console.log(`📋 Generation mode: ${isTextOnlyMode ? "TEXT_2_VIDEO (Prompt Only)" : "REFERENCE_2_VIDEO (Image Reference)"}`);

    // Get user_id from batch
    const { data: batchData, error: batchError } = await supabase
      .from("bulk_video_batches")
      .select("user_id")
      .eq("id", batch_id)
      .single();

    if (batchError || !batchData) {
      throw new Error(`Failed to fetch batch: ${batchError?.message}`);
    }

    const userId = batchData.user_id;

    // Process each user-selected combination
    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];

      // Build avatar name from variables
      const avatarAge = combo.avatar_age || "";
      const avatarGender = combo.avatar_gender || "";
      const avatarName = combo.avatar_name || [avatarAge, avatarGender, "Professional"].filter(Boolean).join(" ");

      const industry = combo.industry_override || base_config.industry;
      const city = combo.city_override || base_config.city;

      // Substitute variables in story idea
      let storyIdea = base_config.story_idea || "";
      for (const [key, value] of Object.entries(combo)) {
        storyIdea = storyIdea.replace(new RegExp(`\\{${key}\\}`, "g"), value);
      }

      console.log(`📝 [Smart Bulk] Creating generation ${i + 1}/${combinations.length}:`, {
        avatarName,
        industry,
        city,
        isTextOnlyMode,
      });

      // Create the individual video generation record
      const { data: generation, error: genError } = await supabase
        .from("kie_video_generations")
        .insert({
          user_id: userId,
          image_url: base_config.image_url || "text-only-mode",
          industry,
          city,
          avatar_name: avatarName,
          story_idea: storyIdea || null,
          model: base_config.model,
          aspect_ratio: base_config.aspect_ratio,
          number_of_scenes: base_config.number_of_scenes,
          is_multi_scene: base_config.number_of_scenes > 1,
          current_scene: 1,
          initial_status: "pending",
          metadata: {
            bulk_batch_id: batch_id,
            variable_values: combo,
            generation_type: base_config.generation_type || "REFERENCE_2_VIDEO",
            smart_bulk: true,
          },
        })
        .select()
        .single();

      if (genError) {
        console.error(`❌ [Smart Bulk] Error creating generation for variation ${i}:`, genError);
        continue;
      }

      // Link generation to batch
      const { error: linkError } = await supabase
        .from("bulk_batch_generations")
        .insert({
          batch_id,
          generation_id: generation.id,
          variable_values: combo,
          variation_index: i,
        });

      if (linkError) {
        console.error(`❌ [Smart Bulk] Error linking generation ${generation.id} to batch:`, linkError);
      }

      console.log(`✅ [Smart Bulk] Created generation ${generation.id} for variation ${i}`);

      // Rate limiting
      if (i < combinations.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Fetch all created generations for this batch
    const { data: batchGenerations } = await supabase
      .from("bulk_batch_generations")
      .select("generation_id, variable_values")
      .eq("batch_id", batch_id)
      .order("variation_index", { ascending: true });

    console.log(`🎬 [Smart Bulk] Starting AI prompt generation for ${batchGenerations?.length || 0} variations`);

    let successCount = 0;
    let failCount = 0;

    for (const gen of batchGenerations || []) {
      try {
        // Fetch the full generation record
        const { data: genRecord, error: fetchError } = await supabase
          .from("kie_video_generations")
          .select("*")
          .eq("id", gen.generation_id)
          .single();

        if (fetchError || !genRecord) {
          console.error(`❌ [Smart Bulk] Failed to fetch generation ${gen.generation_id}:`, fetchError);
          failCount++;
          continue;
        }

        console.log(`🔍 [Smart Bulk] Processing generation ${genRecord.id}: ${genRecord.avatar_name}`);

        const generationType = (genRecord.metadata as { generation_type?: string })?.generation_type || "REFERENCE_2_VIDEO";
        const isTextMode = generationType === "TEXT_2_VIDEO" || genRecord.image_url === "text-only-mode";

        // Step 1: Generate AI prompts
        console.log(`🤖 [Smart Bulk] Generating AI prompts for ${genRecord.id}...`);

        const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-image-kie`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            image_url: isTextMode ? null : genRecord.image_url,
            industry: genRecord.industry,
            avatar_name: genRecord.avatar_name,
            city: genRecord.city,
            story_idea: genRecord.story_idea,
            number_of_scenes: genRecord.number_of_scenes,
          }),
        });

        if (!analyzeResponse.ok) {
          const errorText = await analyzeResponse.text();
          console.error(`❌ [Smart Bulk] AI analysis failed for ${genRecord.id}:`, errorText);

          await supabase
            .from("kie_video_generations")
            .update({
              initial_status: "failed",
              initial_error: `AI prompt generation failed: ${errorText}`,
            })
            .eq("id", genRecord.id);

          failCount++;
          continue;
        }

        const analysisData = await analyzeResponse.json();

        if (!analysisData.success) {
          console.error(`❌ [Smart Bulk] AI analysis returned error for ${genRecord.id}:`, analysisData.error);

          await supabase
            .from("kie_video_generations")
            .update({
              initial_status: "failed",
              initial_error: `AI prompt generation error: ${analysisData.error}`,
            })
            .eq("id", genRecord.id);

          failCount++;
          continue;
        }

        // Parse scene prompts
        let scenePrompts: Array<{ scene_number: number; prompt: string; script?: string }> = [];

        if (genRecord.number_of_scenes === 1) {
          scenePrompts = [
            {
              scene_number: 1,
              prompt: analysisData.prompt,
              script: "",
            },
          ];
        } else {
          scenePrompts = analysisData.scenes.map((scene: { scene_number: number; prompt: string; script?: string }) => ({
            scene_number: scene.scene_number,
            prompt: scene.prompt,
            script: scene.script || "",
          }));
        }

        console.log(`📋 [Smart Bulk] Generated ${scenePrompts.length} scene prompts for ${genRecord.id}`);

        // Update generation with scene prompts
        await supabase
          .from("kie_video_generations")
          .update({
            scene_prompts: scenePrompts,
            ai_prompt: scenePrompts[0]?.prompt || "",
          })
          .eq("id", genRecord.id);

        // Step 2: Trigger video generation
        const firstScene = scenePrompts[0];
        let enhancedPrompt = firstScene?.prompt || "";
        if (firstScene?.script) {
          enhancedPrompt = `${enhancedPrompt}\n\nAVATAR DIALOGUE: "${firstScene.script}"`;
        }

        console.log(`🎥 [Smart Bulk] Starting video generation for ${genRecord.id}...`);

        const generateResponse = await fetch(`${supabaseUrl}/functions/v1/kie-generate-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            generation_id: genRecord.id,
            prompt: enhancedPrompt,
            image_url: isTextMode ? null : genRecord.image_url,
            model: genRecord.model || "veo3_fast",
            aspect_ratio: genRecord.aspect_ratio || "16:9",
            watermark: "",
            avatar_name: genRecord.avatar_name,
            industry: genRecord.industry,
            script: firstScene?.script || "",
            generation_type: generationType,
          }),
        });

        if (!generateResponse.ok) {
          const errorText = await generateResponse.text();
          console.error(`❌ [Smart Bulk] Video generation failed for ${genRecord.id}:`, errorText);
          failCount++;
          continue;
        }

        const generateData = await generateResponse.json();

        if (generateData.success) {
          console.log(`✅ [Smart Bulk] Video generation started for ${genRecord.id}, task_id: ${generateData.task_id}`);
          successCount++;
        } else {
          console.error(`❌ [Smart Bulk] Video generation returned error for ${genRecord.id}:`, generateData.error);
          failCount++;
        }

        // Rate limiting between generations
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`❌ [Smart Bulk] Failed to process generation ${gen.generation_id}:`, err);
        failCount++;
      }
    }

    // Update batch status
    await supabase
      .from("bulk_video_batches")
      .update({
        status: successCount > 0 ? "processing" : "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch_id);

    console.log(`🏁 [Smart Bulk] Generation complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Started smart bulk generation: ${successCount} succeeded, ${failCount} failed`,
        batch_id,
        started: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("❌ [Smart Bulk] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
