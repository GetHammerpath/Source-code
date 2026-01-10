import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { generation_id, edited_prompt, edited_script } = await req.json();

    console.log('🔄 Retry request for generation:', generation_id);
    console.log('📝 Edited prompt provided:', !!edited_prompt);
    console.log('📝 Edited script provided:', !!edited_script);

    // Get generation record
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      throw new Error('Generation not found');
    }

    // Update scene_prompts if edits were provided
    if (edited_prompt || edited_script) {
      const scenePrompts = generation.scene_prompts || [];
      let failedSceneIndex = 0;

      // Determine which scene failed
      if (generation.initial_status === 'failed') {
        failedSceneIndex = 0;
      } else if (generation.extended_status === 'failed') {
        failedSceneIndex = (generation.current_scene || 1) - 1;
      }

      // Update the failed scene with edits
      if (scenePrompts[failedSceneIndex]) {
        scenePrompts[failedSceneIndex] = {
          ...scenePrompts[failedSceneIndex],
          prompt: edited_prompt || scenePrompts[failedSceneIndex].prompt,
          script: edited_script || scenePrompts[failedSceneIndex].script
        };

        console.log(`✏️ Updated scene ${failedSceneIndex + 1} with edited prompt/script`);

        // Save updated scene prompts
        const { error: updateScenesError } = await supabase
          .from('kie_video_generations')
          .update({ scene_prompts: scenePrompts })
          .eq('id', generation_id);

        if (updateScenesError) {
          console.error('❌ Error updating scene prompts:', updateScenesError);
        }
      }
    }

    // Determine what to retry
    if (generation.initial_status === 'failed') {
      console.log('🔄 Retrying initial generation...');
      
      // Get the edited prompt if provided, otherwise use original
      const promptToUse = edited_prompt || generation.ai_prompt;

      // Reset initial generation status
      const { error: updateError } = await supabase
        .from('kie_video_generations')
        .update({
          initial_status: 'pending',
          initial_error: null,
          initial_task_id: null,
          ai_prompt: promptToUse
        })
        .eq('id', generation_id);

      if (updateError) throw updateError;

      // Re-trigger initial generation
      const { data, error } = await supabase.functions.invoke('kie-generate-video', {
        body: {
          generation_id: generation.id,
          prompt: promptToUse,
          image_url: generation.image_url,
          model: generation.model,
          aspect_ratio: generation.aspect_ratio,
          watermark: generation.watermark
        }
      });

      if (error) throw error;

      console.log('✅ Initial generation retry triggered with edited prompt');

      return new Response(JSON.stringify({
        success: true,
        message: 'Retrying initial generation with edits'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } else if (generation.extended_status === 'failed') {
      console.log('🔄 Retrying extension...');
      
      // Reset extension status
      const { error: updateError } = await supabase
        .from('kie_video_generations')
        .update({
          extended_status: 'pending',
          extended_error: null,
          extended_task_id: null
        })
        .eq('id', generation_id);

      if (updateError) throw updateError;

      // Re-trigger extension with edited prompt if provided
      const currentScene = generation.current_scene || 1;
      const scenePrompts = generation.scene_prompts || [];
      const scenePrompt = edited_prompt || scenePrompts[currentScene - 1]?.prompt;

      const { data, error } = await supabase.functions.invoke('kie-extend-next', {
        body: {
          generation_id: generation.id,
          scene_prompt: scenePrompt
        }
      });

      if (error) throw error;

      console.log(`✅ Scene ${currentScene} retry triggered with edited prompt`);

      return new Response(JSON.stringify({
        success: true,
        message: `Retrying scene ${currentScene} generation with edits`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'No failed generation to retry'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error in kie-retry-generation:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Retry failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
