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
    console.log('📥 Kie.ai callback received:', JSON.stringify(payload, null, 2));

    // Handle both direct and nested formats
    const data = payload.data || payload;
    const taskId = data.taskId || payload.taskId;
    const successFlag = data.info?.successFlag ?? data.successFlag ?? payload.successFlag ?? 1;
    const videoUrls = data.info?.resultUrls || data.info?.result_urls || data.response?.resultUrls || data.resultUrls || [];
    const videoUrl = videoUrls[0];
    const errorMessage = data.info?.errorMessage || data.errorMessage || payload.errorMessage;

    if (!taskId) {
      console.error('❌ No taskId found. Full payload:', JSON.stringify(payload, null, 2));
      throw new Error('No taskId in callback payload');
    }

    // Find the generation record by task ID (could be initial or extended)
    const { data: generations, error: findError } = await supabase
      .from('kie_video_generations')
      .select('*')
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

    // Update the appropriate fields based on which task completed
    const updates: any = {};
    const status = successFlag === 1 && videoUrl ? 'completed' : 'failed';
    
    if (isInitial) {
      updates.initial_status = status;
      if (videoUrl) {
        updates.initial_video_url = videoUrl;
        updates.initial_completed_at = new Date().toISOString();
        updates.initial_error = null; // Clear any previous error
        
        // Add to video_segments array
        const currentSegments = generation.video_segments || [];
        // Default duration: 8 seconds for KIE videos (or use generation.duration if available)
        const segmentDuration = (generation.duration || 8) * 1000; // Convert to milliseconds
        updates.video_segments = [
          ...currentSegments,
          {
            url: videoUrl,
            scene: 1,
            type: 'initial',
            duration: segmentDuration,
            completed_at: new Date().toISOString()
          }
        ];
      }
      if (errorMessage || successFlag !== 1) {
        const errorDetail = errorMessage || 'Unknown generation failure';
        // Provide user-friendly message for audio filtering errors
        let userMessage = errorDetail;
        if (errorDetail.includes('AUDIO_FILTERED') || errorDetail.includes('audio') && errorDetail.includes('filter')) {
          userMessage = 'Audio content was filtered by KIE. Try simplifying the avatar script or removing business-specific terms.';
        }
        updates.initial_error = `Generation failed at Kie.ai: ${userMessage}`;
        console.error('❌ Initial generation failed:', {
          taskId,
          generation_id: generation.id,
          errorMessage: errorDetail,
          successFlag
        });
      }
    } else if (isExtended) {
      updates.extended_status = status;
      if (videoUrl) {
        updates.extended_video_url = videoUrl;
        updates.extended_completed_at = new Date().toISOString();
        updates.extended_error = null; // Clear any previous error
        
        // Add to video_segments array
        const currentSegments = generation.video_segments || [];
        const currentScene = generation.current_scene || (currentSegments.length + 1);
        // Default duration: 8 seconds for KIE videos (or use generation.duration if available)
        const segmentDuration = (generation.duration || 8) * 1000; // Convert to milliseconds
        
        updates.video_segments = [
          ...currentSegments,
          {
            url: videoUrl,
            scene: currentScene,
            type: 'extended',
            duration: segmentDuration,
            completed_at: new Date().toISOString()
          }
        ];
      }
      if (errorMessage || successFlag !== 1) {
        const errorDetail = errorMessage || 'Unknown generation failure';
        // Provide user-friendly message for audio filtering errors
        let userMessage = errorDetail;
        if (errorDetail.includes('AUDIO_FILTERED') || errorDetail.includes('audio') && errorDetail.includes('filter')) {
          userMessage = 'Audio content was filtered by KIE. Try simplifying the avatar script or removing business-specific terms.';
        }
        updates.extended_error = `Scene ${generation.current_scene}: Generation failed at Kie.ai: ${userMessage}`;
        console.error('❌ Extended generation failed:', {
          taskId,
          generation_id: generation.id,
          scene: generation.current_scene,
          errorMessage: errorDetail,
          successFlag
        });
      }
    }

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
      const currentSegments = (generation.video_segments || []);
      
      if (generation.is_multi_scene) {
        const numberOfScenes = generation.number_of_scenes || 1;
        const currentScene = generation.current_scene || 1;
        const scenePrompts = generation.scene_prompts || [];
        
        console.log(`📊 Multi-scene progress: Scene ${currentScene} of ${numberOfScenes}`);
        console.log(`📦 Current segments: ${currentSegments.length}`);
        
        if (currentScene < numberOfScenes && scenePrompts.length >= numberOfScenes) {
          // More scenes to generate - use same image for avatar consistency
          const nextSceneIndex = currentScene; // 0-indexed for array
          const nextScenePrompt = scenePrompts[nextSceneIndex].prompt;
          
          console.log(`🎬 Triggering scene ${currentScene + 1} with same avatar image...`);
          
          // Update current scene counter
          await supabase
            .from('kie_video_generations')
            .update({ current_scene: currentScene + 1 })
            .eq('id', generation.id);
          
          // Call extend API for smooth video-to-video transitions
          const extendResponse = await supabase.functions.invoke('kie-extend-next', {
            body: {
              generation_id: generation.id,
              scene_prompt: nextScenePrompt // Pass the scene-specific prompt
            }
          });

          if (extendResponse.error) {
            console.error('❌ Failed to trigger next scene:', extendResponse.error);
          } else {
            console.log('✅ Scene extension triggered successfully');
          }
        } else if (currentScene === numberOfScenes && currentSegments.length === numberOfScenes) {
          // All scenes complete - auto-trigger combine (Cloudinary stitch, KIE-only pipeline)
          console.log('🎉 All scenes complete! Auto-triggering video combine via Cloudinary...');
          
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
            console.error('❌ Failed to trigger combine:', await stitchResponse.text());
          }
        }
      } else {
        // Single scene - auto-trigger first extend only
        if (isInitial && (currentSegments.length === 0 || (currentSegments.length === 1 && currentSegments[0].type === 'initial'))) {
          console.log('✅ Initial video completed, auto-triggering FIRST extend...');
          
          const extendResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/kie-extend-video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              generation_id: generation.id,
              initial_task_id: taskId
            })
          });

          if (!extendResponse.ok) {
            console.error('❌ Failed to trigger extend:', await extendResponse.text());
          }
        }
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
    console.error('❌ Error in kie-callback:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Callback processing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
