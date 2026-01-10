import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Runway Extend callback received:', JSON.stringify(payload));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract data from callback
    const taskId = payload.taskId || payload.data?.taskId;
    const status = payload.status || payload.data?.status;
    const videoUrl = payload.videoUrl || payload.data?.videoUrl || payload.output?.video_url;
    const error = payload.error || payload.data?.error;

    console.log('Parsed callback data:', { taskId, status, videoUrl, error });

    if (!taskId) {
      console.error('No taskId in callback payload');
      return new Response(JSON.stringify({ error: 'No taskId provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the generation by initial_task_id or extended_task_id
    let generation = null;
    let isInitial = false;

    // Check initial_task_id first
    const { data: initialGen } = await supabase
      .from('runway_extend_generations')
      .select('*')
      .eq('initial_task_id', taskId)
      .maybeSingle();

    if (initialGen) {
      generation = initialGen;
      isInitial = true;
    } else {
      // Check extended_task_id
      const { data: extendedGen } = await supabase
        .from('runway_extend_generations')
        .select('*')
        .eq('extended_task_id', taskId)
        .maybeSingle();

      if (extendedGen) {
        generation = extendedGen;
        isInitial = false;
      }
    }

    if (!generation) {
      console.error('No generation found for taskId:', taskId);
      return new Response(JSON.stringify({ error: 'Generation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found generation:', generation.id, 'isInitial:', isInitial, 'current_scene:', generation.current_scene);

    const isSuccess = status === 'completed' || status === 'success' || videoUrl;
    const currentScene = generation.current_scene;
    const totalScenes = generation.number_of_scenes;

    if (isSuccess && videoUrl) {
      // Add to video segments
      const videoSegments = generation.video_segments || [];
      videoSegments.push({
        scene: currentScene,
        task_id: taskId,
        video_url: videoUrl,
        completed_at: new Date().toISOString()
      });

      const updateData: Record<string, any> = {
        video_segments: videoSegments
      };

      if (isInitial) {
        updateData.initial_video_url = videoUrl;
        updateData.initial_status = 'completed';
        updateData.initial_completed_at = new Date().toISOString();
      } else {
        updateData.extended_video_url = videoUrl;
        updateData.extended_status = 'completed';
        updateData.extended_completed_at = new Date().toISOString();
      }

      // Update generation
      await supabase
        .from('runway_extend_generations')
        .update(updateData)
        .eq('id', generation.id);

      console.log('Updated generation with scene', currentScene, 'video');

      // Check if we need more scenes
      if (currentScene < totalScenes) {
        console.log('Triggering next scene:', currentScene + 1);
        
        // Get the next scene prompt
        const scenePrompts = generation.scene_prompts || [];
        const nextScene = scenePrompts[currentScene]; // 0-indexed, currentScene is 1-indexed

        if (nextScene) {
          // Call runway-extend-next to continue
          const extendResponse = await fetch(`${supabaseUrl}/functions/v1/runway-extend-next`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              generation_id: generation.id,
              previous_task_id: taskId,
              scene_number: currentScene + 1,
              scene_prompt: nextScene.prompt,
              scene_script: nextScene.script,
              scene_camera: nextScene.camera
            })
          });

          if (!extendResponse.ok) {
            const extendError = await extendResponse.text();
            console.error('Failed to trigger next scene:', extendError);
          } else {
            console.log('Successfully triggered scene', currentScene + 1);
          }
        }
      } else {
        // All scenes complete - trigger final video stitching
        console.log('All scenes complete, triggering video stitch');
        
        await supabase
          .from('runway_extend_generations')
          .update({ final_video_status: 'processing' })
          .eq('id', generation.id);

        // Call cloudinary stitch
        const stitchResponse = await fetch(`${supabaseUrl}/functions/v1/cloudinary-stitch-videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            generation_id: generation.id,
            table_name: 'runway_extend_generations',
            trim: false
          })
        });

        if (!stitchResponse.ok) {
          const stitchError = await stitchResponse.text();
          console.error('Failed to trigger video stitch:', stitchError);
        }
      }
    } else {
      // Handle failure
      const errorMessage = error || 'Video generation failed';
      console.error('Scene generation failed:', errorMessage);

      const updateData: Record<string, any> = {};
      
      if (isInitial) {
        updateData.initial_status = 'failed';
        updateData.initial_error = errorMessage;
      } else {
        updateData.extended_status = 'failed';
        updateData.extended_error = errorMessage;
      }

      await supabase
        .from('runway_extend_generations')
        .update(updateData)
        .eq('id', generation.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in runway-extend-callback:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
