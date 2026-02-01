import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VariableCombination {
  [key: string]: string;
}

/** Row-based input: 1-to-1 mapping per video */
interface BulkRow {
  avatar_id?: string;
  avatar_name?: string;
  script?: string;
  background?: string;
  industry?: string;
  city?: string;
  story_idea?: string;
  image_url?: string;
  [key: string]: unknown;
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
  sample_size?: number | null;
}

interface RequestBody {
  batch_id: string;
  combinations?: VariableCombination[];
  rows?: BulkRow[];
  base_config: BaseConfig;
  source_type?: "csv" | "ai" | "spinner" | "cartesian";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as RequestBody;
    const { batch_id, base_config, source_type: bodySourceType } = body;
    const rows = body.rows;
    const combinations = body.combinations;

    const useRows = Array.isArray(rows) && rows.length > 0;
    const sourceType = bodySourceType ?? (useRows ? "csv" : "cartesian");
    const items = useRows
      ? rows as BulkRow[]
      : (combinations || []) as VariableCombination[];
    const totalItems = items.length;

    if (totalItems === 0) {
      throw new Error("Either rows or combinations must be provided with at least one item");
    }

    const sampleSize = base_config.sample_size != null ? Number(base_config.sample_size) : null;
    const isSampleRun = sampleSize != null && sampleSize > 0 && totalItems > sampleSize;
    const limit = isSampleRun ? sampleSize : totalItems;

    const isTextOnlyMode = base_config.generation_type === "TEXT_2_VIDEO" || !base_config.image_url;
    console.log(`🚀 Starting bulk generation for batch ${batch_id}: ${totalItems} items, limit=${limit}${isSampleRun ? " (SAMPLE RUN)" : ""}`);
    console.log(`📋 Mode: ${useRows ? "ROWS (1-to-1)" : "COMBINATIONS (legacy)"}, source_type=${sourceType}`);

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

    // Update batch with new schema fields and persist input for resume
    await supabase
      .from("bulk_video_batches")
      .update({
        source_type: sourceType,
        total_rows: totalItems,
        is_paused: false,
        sample_size: sampleSize,
        metadata: {
          ...(typeof (batchData as { metadata?: object }).metadata === "object" ? (batchData as { metadata: object }).metadata : {}),
          input_rows: useRows ? items : undefined,
          input_combinations: !useRows ? items : undefined,
          base_config: {
            image_url: base_config.image_url,
            generation_type: base_config.generation_type,
            industry: base_config.industry,
            city: base_config.city,
            story_idea: base_config.story_idea,
            model: base_config.model,
            aspect_ratio: base_config.aspect_ratio,
            number_of_scenes: base_config.number_of_scenes,
          },
        },
      })
      .eq("id", batch_id);

    // Process each item (row or combination) - create records
    for (let i = 0; i < limit; i++) {
      const item = items[i];
      let avatarName: string;
      let industry: string;
      let city: string;
      let storyIdea: string;
      let imageUrl: string;
      let variableValues: Record<string, unknown>;

      if (useRows) {
        const row = item as BulkRow;
        avatarName = row.avatar_name ?? "Professional";
        industry = row.industry ?? base_config.industry;
        city = row.city ?? base_config.city;
        storyIdea = (row.story_idea ?? row.script ?? base_config.story_idea ?? "").trim();
        imageUrl = row.image_url ?? base_config.image_url ?? "text-only-mode";
        variableValues = { ...row };

        // Resolve avatar_id to image_url if needed
        if (row.avatar_id && !row.image_url) {
          const { data: avatar } = await supabase
            .from("avatars")
            .select("seed_image_url")
            .eq("id", row.avatar_id)
            .eq("user_id", userId)
            .single();
          if (avatar?.seed_image_url) {
            imageUrl = avatar.seed_image_url;
          }
        }
      } else {
        const combo = item as VariableCombination;
        const avatarAge = combo.avatar_age || "";
        const avatarGender = combo.avatar_gender || "";
        avatarName = [avatarAge, avatarGender, "Professional"].filter(Boolean).join(" ");
        industry = combo.industry_override || base_config.industry;
        city = base_config.city;
        storyIdea = base_config.story_idea || "";
        for (const [key, value] of Object.entries(combo)) {
          storyIdea = storyIdea.replace(new RegExp(`\\{${key}\\}`, "g"), value);
        }
        imageUrl = base_config.image_url || "text-only-mode";
        variableValues = combo;
      }

      if (!imageUrl) imageUrl = "text-only-mode";

      console.log(`📝 Creating generation ${i + 1}/${limit}:`, { avatarName, industry, isSampleRun });

      const { data: generation, error: genError } = await supabase
        .from("kie_video_generations")
        .insert({
          user_id: userId,
          image_url: imageUrl,
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
          is_sample: isSampleRun,
          metadata: {
            bulk_batch_id: batch_id,
            variable_values: variableValues,
            generation_type: base_config.generation_type || "REFERENCE_2_VIDEO",
            row_index: i,
          },
        })
        .select()
        .single();

      if (genError) {
        console.error(`❌ Error creating generation for index ${i}:`, genError);
        continue;
      }

      const { error: linkError } = await supabase
        .from("bulk_batch_generations")
        .insert({
          batch_id,
          generation_id: generation.id,
          variable_values: variableValues,
          variation_index: i,
        });

      if (linkError) {
        console.error(`❌ Error linking generation ${generation.id} to batch:`, linkError);
      }

      console.log(`✅ Created generation ${generation.id} for index ${i}`);

      if (i < limit - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Fetch all batch generations for this batch (only the ones we just created, up to limit)
    const { data: batchGenerations } = await supabase
      .from("bulk_batch_generations")
      .select("generation_id, variable_values")
      .eq("batch_id", batch_id)
      .order("variation_index", { ascending: true });

    const toProcess = (batchGenerations || []).slice(0, limit);
    console.log(`🎬 Starting AI prompt generation for ${toProcess.length} variations`);

    let successCount = 0;
    let failCount = 0;

    for (const gen of toProcess) {
      try {
        const { data: genRecord, error: fetchError } = await supabase
          .from("kie_video_generations")
          .select("*")
          .eq("id", gen.generation_id)
          .single();

        if (fetchError || !genRecord) {
          console.error(`❌ Failed to fetch generation ${gen.generation_id}:`, fetchError);
          failCount++;
          continue;
        }

        console.log(`🔍 Processing generation ${genRecord.id}: ${genRecord.avatar_name}`);

        const generationType = (genRecord.metadata as { generation_type?: string })?.generation_type || "REFERENCE_2_VIDEO";
        const isTextMode = generationType === "TEXT_2_VIDEO" || genRecord.image_url === "text-only-mode";

        console.log(`🤖 Generating AI prompts for ${genRecord.id} (mode: ${isTextMode ? "TEXT" : "IMAGE"})...`);

        const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-image-kie`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
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
          console.error(`❌ AI analysis failed for ${genRecord.id}:`, errorText);
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
          console.error(`❌ AI analysis error for ${genRecord.id}:`, analysisData.error);
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

        let scenePrompts: Array<{ scene_number: number; prompt: string; script?: string }> = [];
        if (genRecord.number_of_scenes === 1) {
          scenePrompts = [{ scene_number: 1, prompt: analysisData.prompt, script: "" }];
        } else {
          scenePrompts = (analysisData.scenes || []).map((s: { scene_number: number; prompt: string; script?: string }) => ({
            scene_number: s.scene_number,
            prompt: s.prompt,
            script: s.script || "",
          }));
        }

        await supabase
          .from("kie_video_generations")
          .update({
            scene_prompts: scenePrompts,
            ai_prompt: scenePrompts[0]?.prompt || "",
          })
          .eq("id", genRecord.id);

        const firstScene = scenePrompts[0];
        const firstScenePrompt = firstScene?.prompt || "";
        const firstSceneScript = firstScene?.script || "";
        let enhancedPrompt = firstScenePrompt;
        if (firstSceneScript) {
          enhancedPrompt = `${firstScenePrompt}\n\nAVATAR DIALOGUE: "${firstSceneScript}"`;
        }

        console.log(`🎥 Starting video generation for ${genRecord.id}...`);

        const generateResponse = await fetch(`${supabaseUrl}/functions/v1/kie-generate-video`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
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
            script: firstSceneScript,
            generation_type: generationType,
          }),
        });

        if (!generateResponse.ok) {
          const errorText = await generateResponse.text();
          console.error(`❌ Video generation failed for ${genRecord.id}:`, errorText);
          failCount++;
          continue;
        }

        const generateData = await generateResponse.json();
        if (generateData.success) {
          console.log(`✅ Video generation started for ${genRecord.id}, task_id: ${generateData.task_id}`);
          successCount++;
        } else {
          console.error(`❌ Video generation error for ${genRecord.id}:`, generateData.error);
          failCount++;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`❌ Failed to process generation ${gen.generation_id}:`, err);
        failCount++;
      }
    }

    // Update batch status: paused_for_review if sample run, else processing/failed
    const batchStatus = isSampleRun
      ? "paused_for_review"
      : (successCount > 0 ? "processing" : "failed");

    await supabase
      .from("bulk_video_batches")
      .update({
        status: batchStatus,
        is_paused: isSampleRun,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch_id);

    console.log(`🏁 Bulk generation complete. Success: ${successCount}, Failed: ${failCount}, Status: ${batchStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: isSampleRun
          ? `Sample run complete: ${successCount} started. Batch paused for review.`
          : `Started bulk generation: ${successCount} succeeded, ${failCount} failed`,
        batch_id,
        started: successCount,
        failed: failCount,
        paused_for_review: isSampleRun,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("❌ Error in bulk-generate-videos:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
