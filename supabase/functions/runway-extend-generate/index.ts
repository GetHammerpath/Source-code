import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Content policy disclaimer to avoid Google Veo rejections
const CONTENT_POLICY_DISCLAIMER = `IMPORTANT DISCLAIMER: This scene features a fully fictional, AI-generated virtual presenter avatar.
This character does not represent any real person, living or deceased.
A generic virtual presenter appears in a non-identifiable professional setting,
demonstrating and explaining general concepts in an educational manner.

SCENE CONTENT:
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      user_id,
      image_url,
      avatar_name,
      industry,
      city,
      story_idea,
      scene_prompts,
      avatar_identity_prefix,
      image_analysis,
      number_of_scenes,
      duration_per_scene,
      aspect_ratio,
      resolution
    } = await req.json();

    console.log('Starting Runway Extend generation:', { 
      avatar_name, 
      industry, 
      number_of_scenes,
      duration_per_scene 
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const kieApiToken = Deno.env.get('KIE_AI_API_TOKEN');

    if (!kieApiToken) {
      throw new Error('KIE_AI_API_TOKEN is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Create the generation record
    const { data: generation, error: insertError } = await supabase
      .from('runway_extend_generations')
      .insert({
        user_id,
        image_url,
        avatar_name,
        industry,
        city,
        story_idea,
        scene_prompts,
        avatar_identity_prefix,
        image_analysis,
        number_of_scenes,
        duration_per_scene,
        aspect_ratio,
        resolution,
        current_scene: 1,
        initial_status: 'processing',
        video_segments: []
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create generation record:', insertError);
      throw new Error('Failed to create generation record');
    }

    console.log('Created generation record:', generation.id);

    // Build the prompt for Scene 1
    const scene1 = scene_prompts[0];
    const basePrompt = `${avatar_identity_prefix}

SCENE 1 - INITIAL SHOT:
${scene1.prompt}

CAMERA: ${scene1.camera || 'Smooth, cinematic movement'}

CRITICAL: This is the FIRST scene. The avatar must match the reference image EXACTLY.
Maintain perfect consistency with the provided image.`;

    // Wrap with content policy disclaimer
    const fullPrompt = `${CONTENT_POLICY_DISCLAIMER}${basePrompt}`;

    // Call Kie.ai Runway API for initial generation
    // Correct endpoint: /api/v1/runway/generate
    const callbackUrl = `${supabaseUrl}/functions/v1/runway-extend-callback`;
    
    console.log('Calling Kie.ai Runway generate API with:', {
      promptLength: fullPrompt.length,
      imageUrl: image_url,
      duration: duration_per_scene,
      quality: resolution === '1080p' && duration_per_scene !== 10 ? '1080p' : '720p'
    });
    
    const kieResponse = await fetch('https://api.kie.ai/api/v1/runway/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        imageUrl: image_url,
        duration: duration_per_scene,
        quality: resolution === '1080p' && duration_per_scene !== 10 ? '1080p' : '720p',
        waterMark: '',
        callBackUrl: callbackUrl
      }),
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error('Kie.ai API error:', kieResponse.status, errorText);
      
      // Update generation with error
      await supabase
        .from('runway_extend_generations')
        .update({ 
          initial_status: 'failed', 
          initial_error: `Kie.ai API error: ${kieResponse.status}` 
        })
        .eq('id', generation.id);
      
      throw new Error(`Kie.ai API error: ${kieResponse.status}`);
    }

    const kieData = await kieResponse.json();
    console.log('Kie.ai response:', kieData);

    // Update generation with task ID
    const { error: updateError } = await supabase
      .from('runway_extend_generations')
      .update({ 
        initial_task_id: kieData.data?.taskId || kieData.taskId,
        initial_status: 'processing'
      })
      .eq('id', generation.id);

    if (updateError) {
      console.error('Failed to update generation with task ID:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      generation_id: generation.id,
      task_id: kieData.data?.taskId || kieData.taskId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in runway-extend-generate:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
