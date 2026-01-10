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

    const { generation_id } = await req.json();

    console.log('🎬 Processing next scene for generation:', generation_id);

    // Fetch generation details
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      console.error('❌ Generation not found:', generation_id);
      throw new Error('Generation not found');
    }

    const currentScene = generation.current_scene || 1;
    const nextScene = currentScene + 1;

    console.log(`📍 Current scene: ${currentScene}, Next scene: ${nextScene}, Total: ${generation.number_of_scenes}`);

    if (nextScene > generation.number_of_scenes) {
      console.log('✅ All scenes completed');
      return new Response(
        JSON.stringify({ success: true, message: 'All scenes completed' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get next scene prompt (scenes are 1-indexed but array is 0-indexed)
    const scenePrompts = generation.scene_prompts || [];
    const nextSceneData = scenePrompts[nextScene - 1];

    if (!nextSceneData) {
      console.error('❌ Next scene prompt not found for scene', nextScene);
      throw new Error(`Scene ${nextScene} prompt not found`);
    }

    const scenePrompt = nextSceneData.prompt || nextSceneData.Scene;
    console.log(`🎭 Generating scene ${nextScene}:`, scenePrompt?.substring(0, 100) + '...');

    const KIE_API_TOKEN = Deno.env.get("KIE_AI_API_TOKEN");
    if (!KIE_API_TOKEN) {
      throw new Error("KIE_AI_API_TOKEN is not configured");
    }

    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sora-callback`;

    // Call Kie.ai to generate next scene
    const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sora-2-pro-storyboard',
        callBackUrl: callbackUrl,
        input: {
          n_frames: (generation.duration || 10).toString(),
          image_urls: [generation.image_url],
          aspect_ratio: generation.aspect_ratio === '16:9' ? 'landscape' : 'portrait',
          shots: [
            {
              Scene: nextSceneData.prompt || nextSceneData.Scene,
              duration: nextSceneData.duration || generation.duration || 10
            }
          ]
        }
      })
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error('❌ Kie.ai API error for scene', nextScene, ':', errorText);
      
      await supabase
        .from('kie_video_generations')
        .update({
          extended_status: 'failed',
          extended_error: `Scene ${nextScene} generation failed: ${errorText}`
        })
        .eq('id', generation_id);

      throw new Error(`Kie.ai API error: ${errorText}`);
    }

    const result = await kieResponse.json();
    const taskId = result.data?.taskId;

    if (!taskId) {
      throw new Error('No taskId received from Kie.ai for scene ' + nextScene);
    }

    console.log(`✅ Scene ${nextScene} task created:`, taskId);

    // Update database with next scene task ID
    const updates: any = {
      extended_task_id: taskId,
      extended_status: 'generating',
      current_scene: nextScene
    };

    // Store video segment for previous scene
    if (generation.initial_video_url) {
      const videoSegments = [
        ...(generation.video_segments || []),
        {
          scene: currentScene,
          video_url: generation.initial_video_url,
          completed_at: generation.initial_completed_at
        }
      ];
      updates.video_segments = videoSegments;
    }

    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update(updates)
      .eq('id', generation_id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log(`✅ Database updated for scene ${nextScene}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        task_id: taskId,
        scene: nextScene
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Error in sora-extend-next:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
