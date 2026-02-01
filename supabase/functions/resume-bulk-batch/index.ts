import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VariableCombination {
  [key: string]: string;
}

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { batch_id } = (await req.json()) as { batch_id: string };
    if (!batch_id) {
      throw new Error("batch_id is required");
    }

    // Fetch batch with metadata
    const { data: batch, error: batchError } = await supabase
      .from("bulk_video_batches")
      .select("id, user_id, status, is_paused, metadata")
      .eq("id", batch_id)
      .single();

    if (batchError || !batch) {
      throw new Error(`Failed to fetch batch: ${batchError?.message}`);
    }

    if (!batch.is_paused && batch.status !== "paused_for_review") {
      throw new Error(`Batch is not paused. Status: ${batch.status}`);
    }

    const meta = (batch.metadata || {}) as {
      input_rows?: BulkRow[];
      input_combinations?: VariableCombination[];
      base_config?: BaseConfig;
    };

    const baseConfig = meta.base_config;
    if (!baseConfig) {
      throw new Error("Batch metadata missing base_config. Cannot resume.");
    }

    const useRows = Array.isArray(meta.input_rows) && meta.input_rows.length > 0;
    const items = useRows ? meta.input_rows! : (meta.input_combinations || []);

    if (items.length === 0) {
      throw new Error("No input rows or combinations in batch metadata.");
    }

    // Get existing variation indices
    const { data: existing } = await supabase
      .from("bulk_batch_generations")
      .select("variation_index")
      .eq("batch_id", batch_id);

    const existingIndices = new Set((existing || []).map((r) => r.variation_index));
    const remainingIndices = items
      .map((_, i) => i)
      .filter((i) => !existingIndices.has(i));

    if (remainingIndices.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No remaining rows to generate. Batch already complete.",
          batch_id,
          created: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔄 Resuming batch ${batch_id}: ${remainingIndices.length} remaining rows`);

    const userId = batch.user_id;
    const isTextOnlyMode = baseConfig.generation_type === "TEXT_2_VIDEO" || !baseConfig.image_url;

    for (const i of remainingIndices) {
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
        industry = row.industry ?? baseConfig.industry;
        city = row.city ?? baseConfig.city;
        storyIdea = row.story_idea ?? baseConfig.story_idea ?? "";
        imageUrl = row.image_url ?? baseConfig.image_url ?? "text-only-mode";
        variableValues = { ...row };

        if (row.avatar_id && !row.image_url) {
          const { data: avatar } = await supabase
            .from("avatars")
            .select("seed_image_url")
            .eq("id", row.avatar_id)
            .eq("user_id", userId)
            .single();
          if (avatar?.seed_image_url) imageUrl = avatar.seed_image_url;
        }
      } else {
        const combo = item as VariableCombination;
        const avatarAge = combo.avatar_age || "";
        const avatarGender = combo.avatar_gender || "";
        avatarName = [avatarAge, avatarGender, "Professional"].filter(Boolean).join(" ");
        industry = combo.industry_override || baseConfig.industry;
        city = baseConfig.city;
        storyIdea = baseConfig.story_idea || "";
        for (const [key, value] of Object.entries(combo)) {
          storyIdea = storyIdea.replace(new RegExp(`\\{${key}\\}`, "g"), value);
        }
        imageUrl = baseConfig.image_url || "text-only-mode";
        variableValues = combo;
      }

      if (!imageUrl) imageUrl = "text-only-mode";

      const { data: generation, error: genError } = await supabase
        .from("kie_video_generations")
        .insert({
          user_id: userId,
          image_url: imageUrl,
          industry,
          city,
          avatar_name: avatarName,
          story_idea: storyIdea || null,
          model: baseConfig.model,
          aspect_ratio: baseConfig.aspect_ratio,
          number_of_scenes: baseConfig.number_of_scenes,
          is_multi_scene: baseConfig.number_of_scenes > 1,
          current_scene: 1,
          initial_status: "pending",
          is_sample: false,
          metadata: {
            bulk_batch_id: batch_id,
            variable_values: variableValues,
            generation_type: baseConfig.generation_type || "REFERENCE_2_VIDEO",
            row_index: i,
          },
        })
        .select()
        .single();

      if (genError) {
        console.error(`❌ Error creating generation for index ${i}:`, genError);
        continue;
      }

      await supabase.from("bulk_batch_generations").insert({
        batch_id,
        generation_id: generation.id,
        variable_values: variableValues,
        variation_index: i,
      });

      if (i !== remainingIndices[remainingIndices.length - 1]) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // Fetch newly created generations and trigger processing
    const { data: batchGens } = await supabase
      .from("bulk_batch_generations")
      .select("generation_id")
      .eq("batch_id", batch_id)
      .in("variation_index", remainingIndices)
      .order("variation_index", { ascending: true });

    let successCount = 0;
    let failCount = 0;

    for (const gen of batchGens || []) {
      try {
        const { data: genRecord, error: fetchErr } = await supabase
          .from("kie_video_generations")
          .select("*")
          .eq("id", gen.generation_id)
          .single();

        if (fetchErr || !genRecord) {
          failCount++;
          continue;
        }

        const generationType = (genRecord.metadata as { generation_type?: string })?.generation_type || "REFERENCE_2_VIDEO";
        const isTextMode = generationType === "TEXT_2_VIDEO" || genRecord.image_url === "text-only-mode";

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
          const errText = await analyzeResponse.text();
          await supabase
            .from("kie_video_generations")
            .update({ initial_status: "failed", initial_error: `AI prompt failed: ${errText}` })
            .eq("id", genRecord.id);
          failCount++;
          continue;
        }

        const analysisData = await analyzeResponse.json();
        if (!analysisData.success) {
          await supabase
            .from("kie_video_generations")
            .update({ initial_status: "failed", initial_error: analysisData.error })
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
          .update({ scene_prompts: scenePrompts, ai_prompt: scenePrompts[0]?.prompt || "" })
          .eq("id", genRecord.id);

        const firstScene = scenePrompts[0];
        const firstScenePrompt = firstScene?.prompt || "";
        const firstSceneScript = firstScene?.script || "";
        let enhancedPrompt = firstScenePrompt;
        if (firstSceneScript) enhancedPrompt = `${firstScenePrompt}\n\nAVATAR DIALOGUE: "${firstSceneScript}"`;

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
          failCount++;
          continue;
        }

        const genData = await generateResponse.json();
        if (genData.success) successCount++;
        else failCount++;

        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error(`❌ Resume failed for gen ${gen.generation_id}:`, err);
        failCount++;
      }
    }

    await supabase
      .from("bulk_video_batches")
      .update({
        status: "processing",
        is_paused: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch_id);

    console.log(`🏁 Resume complete. Started: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Resumed batch: ${successCount} started, ${failCount} failed`,
        batch_id,
        started: successCount,
        failed: failCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("❌ Error in resume-bulk-batch:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
