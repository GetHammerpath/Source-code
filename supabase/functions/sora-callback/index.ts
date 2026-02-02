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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    console.log('📥 Sora callback received:', JSON.stringify(payload, null, 2));

    // Extract from Sora's nested structure
    const code = payload.code;
    const data = payload.data;
    const taskId = data?.taskId;
    const state = data?.state; // "success" or "failed"
    const resultJsonString = data?.resultJson; // Stringified JSON!
    const msg = payload.msg;

    if (!taskId) {
      console.error('❌ No taskId in callback payload');
      return new Response(
        JSON.stringify({ error: 'No taskId in payload' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('🔍 Processing callback for task:', taskId, 'state:', state);

    // Parse the stringified resultJson
    let videoUrl = null;
    let audioUrl = null;
    if (state === 'success' && resultJsonString) {
      try {
        const resultJson = JSON.parse(resultJsonString);
        console.log('📦 Parsed resultJson:', resultJson);
        
        const resultUrls = resultJson.resultUrls || [];
        videoUrl = Array.isArray(resultUrls) ? resultUrls[0] : resultUrls;
        
        // Check if there's a separate audio URL (structure TBD, might be in audioUrls or metadata)
        if (resultJson.audioUrls && Array.isArray(resultJson.audioUrls)) {
          audioUrl = resultJson.audioUrls[0];
        }
      } catch (parseError) {
        console.error('❌ Failed to parse resultJson:', parseError);
      }
    }

    // Find generation by task ID (check both initial and extended)
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .or(`initial_task_id.eq.${taskId},extended_task_id.eq.${taskId}`)
      .single();

    if (fetchError || !generation) {
      console.error('❌ Generation not found for taskId:', taskId, fetchError);
      return new Response(
        JSON.stringify({ error: 'Generation not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('✅ Found generation:', generation.id);

    const successFlag = state === 'success' && videoUrl;

    // Determine if this is initial or extended generation
    const isInitialGeneration = generation.initial_task_id === taskId;

    if (isInitialGeneration) {
      console.log('📝 Updating initial generation status');
      
      const updates: any = {
        initial_status: successFlag ? 'completed' : 'failed',
        initial_video_url: videoUrl,
        initial_completed_at: successFlag ? new Date().toISOString() : null,
        metadata: {
          ...generation.metadata,
          sora_credits_consumed: data?.consumeCredits,
          sora_credits_remaining: data?.remainedCredits,
          complete_time: data?.completeTime,
          cost_time: data?.costTime
        }
      };

      if (!successFlag) {
        updates.initial_error = msg || 'Video generation failed';
      }

      if (audioUrl) {
        updates.metadata.audio_url = audioUrl;
      }

      const { error: updateError } = await supabase
        .from('kie_video_generations')
        .update(updates)
        .eq('id', generation.id);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }

      // If multi-scene and successful, trigger next scene (skip for storyboard model)
      if (successFlag && generation.is_multi_scene && generation.current_scene < generation.number_of_scenes && generation.sora_model !== 'sora-2-pro-storyboard') {
        console.log('🎬 Triggering next scene generation');
        
        const { error: extendError } = await supabase.functions.invoke('sora-extend-next', {
          body: { generation_id: generation.id }
        });

        if (extendError) {
          console.error('❌ Failed to trigger next scene:', extendError);
        }
      }

      // Log if storyboard model (all scenes in one video)
      if (generation.sora_model === 'sora-2-pro-storyboard') {
        console.log('📹 Storyboard model - all scenes rendered in single video');
      }

      // If storyboard model or single-scene or final scene completed successfully, mark as final
      if (successFlag && (generation.sora_model === 'sora-2-pro-storyboard' || !generation.is_multi_scene || generation.current_scene >= generation.number_of_scenes)) {
        console.log('✅ Marking as final video');
        
        await supabase
          .from('kie_video_generations')
          .update({
            is_final: true,
            final_video_url: videoUrl,
            final_video_status: 'completed',
            final_video_completed_at: new Date().toISOString()
          })
          .eq('id', generation.id);
      }

    } else {
      // Extended generation callback
      console.log('📝 Updating extended generation status');
      
      const updates: any = {
        extended_status: successFlag ? 'completed' : 'failed',
        extended_video_url: videoUrl,
        extended_completed_at: successFlag ? new Date().toISOString() : null
      };

      if (!successFlag) {
        updates.extended_error = msg || 'Video extension failed';
      }

      const { error: updateError } = await supabase
        .from('kie_video_generations')
        .update(updates)
        .eq('id', generation.id);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }

      // Progress to next scene if multi-scene (skip for storyboard model)
      if (successFlag && generation.is_multi_scene && generation.current_scene < generation.number_of_scenes && generation.sora_model !== 'sora-2-pro-storyboard') {
        console.log('🎬 Triggering next scene from extension');
        
        const { error: extendError } = await supabase.functions.invoke('sora-extend-next', {
          body: { generation_id: generation.id }
        });

        if (extendError) {
          console.error('❌ Failed to trigger next scene:', extendError);
        }
      }

      // If final scene, update video segments and prepare for stitching
      if (successFlag && generation.current_scene >= generation.number_of_scenes) {
        console.log('✅ Final scene completed, preparing for stitching');
        
        const videoSegments = [
          ...(generation.video_segments || []),
          {
            scene: generation.current_scene,
            video_url: videoUrl,
            completed_at: new Date().toISOString()
          }
        ];

        await supabase
          .from('kie_video_generations')
          .update({
            video_segments: videoSegments,
            is_final: true,
            final_video_url: videoUrl, // Use last scene as final for now
            final_video_status: 'completed',
            final_video_completed_at: new Date().toISOString()
          })
          .eq('id', generation.id);

        // TODO: Implement video stitching if Sora returns separate videos per scene
        // For now, assuming Sora storyboard returns a unified video
      }
    }

    console.log('✅ Callback processed successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Error in sora-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
