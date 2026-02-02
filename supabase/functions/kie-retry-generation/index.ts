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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: { generation_id?: string; edited_prompt?: string; edited_script?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const generation_id = body?.generation_id;
    const edited_prompt = body?.edited_prompt;
    const edited_script = body?.edited_script;
    if (!generation_id) {
      return new Response(JSON.stringify({ success: false, error: 'generation_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      return new Response(JSON.stringify({ success: false, error: 'Generation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // When called from client (user JWT), verify ownership
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isServiceRole = !!serviceKey && bearer === serviceKey;
    if (!isServiceRole) {
      const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await supabaseAnon.auth.getUser();
      if (authErr || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid or expired session' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (generation.user_id !== user.id) {
        return new Response(JSON.stringify({ success: false, error: 'This video does not belong to you' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
      
      let promptToUse = edited_prompt || generation.ai_prompt || '';
      let scenePrompts = (generation.scene_prompts || []) as Array<{ scene_number: number; prompt: string; script?: string }>;

      // If no prompt and we have story_idea, call analyze-image-kie to generate prompts first
      if ((!promptToUse || !promptToUse.trim()) && (generation.story_idea || generation.script)) {
        console.log('🤖 No prompts found; calling analyze-image-kie to generate...');
        const genType = (generation.metadata as { generation_type?: string })?.generation_type || 'REFERENCE_2_VIDEO';
        const isTextMode = genType === 'TEXT_2_VIDEO' || generation.image_url === 'text-only-mode';

        const analyzeRes = await fetch(`${supabaseUrl}/functions/v1/analyze-image-kie`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            image_url: isTextMode ? null : generation.image_url,
            industry: generation.industry || 'General',
            avatar_name: generation.avatar_name || 'Professional',
            city: generation.city || 'N/A',
            story_idea: generation.story_idea || generation.script || '',
            number_of_scenes: generation.number_of_scenes || 1,
          }),
        });

        if (!analyzeRes.ok) {
          const errText = await analyzeRes.text();
          throw new Error(`AI prompt generation failed: ${errText}`);
        }

        const analysisData = await analyzeRes.json();
        if (!analysisData.success) {
          throw new Error(analysisData.error || 'AI prompt generation failed');
        }

        const numScenes = generation.number_of_scenes || 1;
        if (numScenes === 1) {
          scenePrompts = [{ scene_number: 1, prompt: analysisData.prompt || '', script: '' }];
        } else {
          scenePrompts = (analysisData.scenes || []).map((s: { scene_number?: number; prompt?: string; script?: string }, i: number) => ({
            scene_number: (s.scene_number ?? i + 1),
            prompt: s.prompt || '',
            script: s.script || '',
          }));
        }
        promptToUse = scenePrompts[0]?.prompt || analysisData.prompt || '';

        await supabase
          .from('kie_video_generations')
          .update({
            scene_prompts: scenePrompts,
            ai_prompt: promptToUse,
          })
          .eq('id', generation_id);
        console.log('✓ AI prompts generated and saved');
      }

      if (!promptToUse || !promptToUse.trim()) {
        throw new Error('No prompt available. Add a story_idea or script to the generation and retry.');
      }

      const firstScene = scenePrompts[0];
      const firstScript = firstScene?.script || '';
      const enhancedPrompt = firstScript
        ? `${promptToUse}\n\nAVATAR DIALOGUE: "${firstScript}"`
        : promptToUse;

      const genType = (generation.metadata as { generation_type?: string })?.generation_type || 'REFERENCE_2_VIDEO';

      // Reset initial generation status
      const { error: updateError } = await supabase
        .from('kie_video_generations')
        .update({
          initial_status: 'pending',
          initial_error: null,
          initial_task_id: null,
          ai_prompt: promptToUse,
        })
        .eq('id', generation_id);

      if (updateError) throw updateError;

      // Re-trigger via fetch (server-to-server with service role)
      const genRes = await fetch(`${supabaseUrl}/functions/v1/video-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          generation_id: generation.id,
          prompt: enhancedPrompt,
          image_url: generation.image_url,
          model: generation.model || 'veo3_fast',
          aspect_ratio: generation.aspect_ratio || '16:9',
          watermark: generation.watermark || '',
          avatar_name: generation.avatar_name,
          industry: generation.industry,
          script: firstScript,
          generation_type: genType,
        }),
      });

      if (!genRes.ok) {
        const errText = await genRes.text();
        throw new Error(errText || 'Failed to start video generation');
      }

      const genData = await genRes.json();
      if (!genData.success) {
        throw new Error(genData.error || 'Video generation failed to start');
      }

      console.log('✅ Initial generation retry triggered');

      return new Response(JSON.stringify({
        success: true,
        message: 'Video is being recreated. It may take a few minutes.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
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
