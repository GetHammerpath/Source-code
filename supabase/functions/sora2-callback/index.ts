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

    const payload = await req.json();
    console.log('📥 Sora2 callback received:', JSON.stringify(payload, null, 2));

    // Handle both direct and nested formats
    const data = payload.data || payload;
    const taskId = data.taskId || payload.taskId;
    
    // Fix: Check state === 'success' for Kie.ai response format
    const isSuccess = data.state === 'success';
    const successFlag = isSuccess ? 1 : (data.info?.successFlag ?? data.successFlag ?? payload.successFlag ?? 0);
    
    // Fix: Parse resultJson string to extract video URLs
    let videoUrls: string[] = [];
    if (data.resultJson) {
      try {
        const resultData = typeof data.resultJson === 'string' 
          ? JSON.parse(data.resultJson) 
          : data.resultJson;
        videoUrls = resultData.resultUrls || resultData.result_urls || [];
        console.log('📦 Parsed resultJson, found URLs:', videoUrls);
      } catch (e) {
        console.log('⚠️ Failed to parse resultJson:', e);
      }
    }
    
    // Fallback to other paths if resultJson parsing didn't work
    if (!videoUrls.length) {
      videoUrls = data.info?.resultUrls || data.info?.result_urls || 
                  data.response?.resultUrls || data.resultUrls || [];
    }
    
    const videoUrl = videoUrls[0];
    const errorMessage = data.info?.errorMessage || data.errorMessage || payload.errorMessage;
    
    console.log(`📊 Parsed callback - Success: ${isSuccess}, Video URL: ${videoUrl ? 'found' : 'missing'}`);

    if (!taskId) {
      console.error('❌ No taskId found. Full payload:', JSON.stringify(payload, null, 2));
      throw new Error('No taskId in callback payload');
    }

    // Find the generation record by task ID (could be initial or extended)
    const { data: generations, error: findError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('sora_model', 'sora-2-pro-image-to-video')
      .or(`initial_task_id.eq.${taskId},extended_task_id.eq.${taskId}`)
      .limit(1);

    if (findError || !generations || generations.length === 0) {
      console.error('❌ Generation not found for taskId:', taskId);
      throw new Error('Generation record not found');
    }

    const generation = generations[0];
    const isInitial = generation.initial_task_id === taskId;
    const isExtended = generation.extended_task_id === taskId;

    console.log(`📹 Updating ${isInitial ? 'initial' : 'extended'} generation:`, generation.id);
    console.log(`📊 Current scene: ${generation.current_scene} of ${generation.number_of_scenes}`);

    // Update the appropriate fields based on which task completed
    const updates: any = {};
    const status = successFlag === 1 && videoUrl ? 'completed' : 'failed';
    const currentSegments = generation.video_segments || [];
    const currentScene = generation.current_scene || 1;
    
    if (isInitial) {
      updates.initial_status = status;
      if (videoUrl) {
        updates.initial_video_url = videoUrl;
        updates.initial_completed_at = new Date().toISOString();
        updates.initial_error = null;
        
        // Add to video_segments array
        updates.video_segments = [
          ...currentSegments,
          {
            url: videoUrl,
            scene: 1,
            type: 'initial',
            duration: (generation.duration || 10) * 1000,
            completed_at: new Date().toISOString()
          }
        ];
      }
      if (errorMessage || successFlag !== 1) {
        updates.initial_error = `Scene 1 failed: ${errorMessage || 'Unknown error'}`;
      }
    } else if (isExtended) {
      updates.extended_status = status;
      if (videoUrl) {
        updates.extended_video_url = videoUrl;
        updates.extended_completed_at = new Date().toISOString();
        updates.extended_error = null;
        
        // Add to video_segments array
        updates.video_segments = [
          ...currentSegments,
          {
            url: videoUrl,
            scene: currentScene,
            type: 'extended',
            duration: (generation.duration || 10) * 1000,
            completed_at: new Date().toISOString()
          }
        ];
      }
      if (errorMessage || successFlag !== 1) {
        updates.extended_error = `Scene ${currentScene} failed: ${errorMessage || 'Unknown error'}`;
      }
    }

    // Apply updates
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update(updates)
      .eq('id', generation.id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    // Handle multi-scene orchestration
    if (successFlag === 1 && videoUrl) {
      const newSegmentsCount = (updates.video_segments || currentSegments).length;
      const numberOfScenes = generation.number_of_scenes || 1;
      const scenePrompts = generation.scene_prompts || [];
      const isMultiScene = generation.is_multi_scene || numberOfScenes > 1;

      console.log(`📊 Multi-scene orchestration check:
  - Completed segments: ${newSegmentsCount}
  - Total scenes needed: ${numberOfScenes}
  - Scene prompts available: ${scenePrompts.length}
  - Is multi-scene: ${isMultiScene}
  - Current scene was: ${currentScene}`);

      if (isMultiScene && newSegmentsCount < numberOfScenes) {
        // More scenes to generate
        const nextSceneIndex = newSegmentsCount; // 0-indexed for array
        const nextScenePrompt = scenePrompts[nextSceneIndex];
        const nextSceneNumber = newSegmentsCount + 1;

        console.log(`🎬 Preparing to trigger scene ${nextSceneNumber} of ${numberOfScenes}`);
        console.log(`📝 Next scene prompt preview: ${nextScenePrompt?.prompt?.substring(0, 100) || 'NO PROMPT FOUND'}...`);

        if (!nextScenePrompt || !nextScenePrompt.prompt) {
          console.error(`❌ No scene prompt found for scene ${nextSceneNumber} at index ${nextSceneIndex}`);
          console.error(`Available scene prompts:`, JSON.stringify(scenePrompts, null, 2));
        } else {
          // Update current scene counter BEFORE triggering next scene
          const { error: sceneUpdateError } = await supabase
            .from('kie_video_generations')
            .update({ 
              current_scene: nextSceneNumber,
              extended_status: 'pending'
            })
            .eq('id', generation.id);

          if (sceneUpdateError) {
            console.error('❌ Failed to update current_scene:', sceneUpdateError);
          } else {
            console.log(`✅ Updated current_scene to ${nextSceneNumber}`);
          }

          // Call extend function for next scene
          console.log(`🚀 Calling sora2-extend-next for scene ${nextSceneNumber}...`);
          
          const extendResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sora2-extend-next`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              generation_id: generation.id,
              scene_prompt: nextScenePrompt.prompt,
              scene_script: nextScenePrompt.script || ''
            })
          });

          const extendResponseText = await extendResponse.text();
          
          if (!extendResponse.ok) {
            console.error(`❌ Failed to trigger scene ${nextSceneNumber}:`, extendResponseText);
            
            // Update with error status
            await supabase
              .from('kie_video_generations')
              .update({ 
                extended_status: 'failed',
                extended_error: `Failed to start scene ${nextSceneNumber}: ${extendResponseText}`
              })
              .eq('id', generation.id);
          } else {
            console.log(`✅ Scene ${nextSceneNumber} triggered successfully:`, extendResponseText);
          }
        }
      } else if (newSegmentsCount >= numberOfScenes) {
        // All scenes complete - trigger stitching
        console.log(`🎉 All ${numberOfScenes} scenes complete! Triggering video combine...`);
        console.log(`📹 Video segments:`, JSON.stringify(updates.video_segments, null, 2));

        const stitchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cloudinary-stitch-videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            generation_id: generation.id,
            trim: false
          })
        });

        if (!stitchResponse.ok) {
          const stitchError = await stitchResponse.text();
          console.error('❌ Failed to trigger combine:', stitchError);
        } else {
          console.log('✅ Video combine triggered successfully');
        }
      } else {
        console.log(`ℹ️ Single scene video or scene prompts mismatch - no further orchestration needed`);
      }
    }

    console.log('✅ Callback processed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Callback processed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in sora2-callback:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Callback processing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
