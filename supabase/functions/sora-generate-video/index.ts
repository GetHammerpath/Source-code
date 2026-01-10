import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const parseKieError = (status: number, errorText: string) => {
  console.log('🔍 Parsing Kie.ai error:', status, errorText);
  
  if (status === 429) {
    return { 
      type: 'RATE_LIMITED', 
      message: 'Rate limit exceeded. Please wait a moment and try again.' 
    };
  }
  
  if (status === 402) {
    return { 
      type: 'CREDIT_EXHAUSTED', 
      message: 'Insufficient credits. Please add more credits to your Kie.ai account.' 
    };
  }
  
  if (errorText.toLowerCase().includes('credit')) {
    return { 
      type: 'CREDIT_EXHAUSTED', 
      message: 'Insufficient credits for video generation.' 
    };
  }
  
  if (status === 401 || status === 403) {
    return { 
      type: 'AUTH_ERROR', 
      message: 'Authentication failed. Please check your Kie.ai API key.' 
    };
  }
  
  if (status === 400) {
    return { 
      type: 'INVALID_PARAMS', 
      message: `Invalid parameters: ${errorText}` 
    };
  }
  
  return { 
    type: 'API_ERROR', 
    message: errorText || 'Kie.ai API error occurred' 
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { 
      generation_id, 
      prompt,
      image_url, 
      model = 'sora-2-pro-storyboard',
      aspect_ratio = '16:9',
      duration = 10,
      watermark,
      audio_enabled = true,
      shots = []
    } = await req.json();

    console.log('🎬 Starting Sora video generation:', {
      generation_id,
      model,
      aspect_ratio,
      duration,
      audio_enabled,
      shots_count: shots.length
    });

    const KIE_API_TOKEN = Deno.env.get("KIE_AI_API_TOKEN");
    if (!KIE_API_TOKEN) {
      throw new Error("KIE_AI_API_TOKEN is not configured");
    }

    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sora-callback`;
    
    // Prepare shots array - use provided shots or create single shot from prompt
    // Accept multiple formats: visual_prompt + script, prompt, or Scene (old format)
    // Wrap each prompt with content policy disclaimer
    const shotsArray = shots.length > 0 ? shots.map((shot: any) => {
      let combinedPrompt = '';
      
      // New format: separate visual_prompt and script
      if (shot.visual_prompt || shot.script) {
        const visualPart = shot.visual_prompt || '';
        const scriptPart = shot.script || '';
        combinedPrompt = scriptPart 
          ? `${visualPart}. DIALOGUE: "${scriptPart}"`
          : visualPart;
      } else {
        // Old formats: prompt or Scene
        combinedPrompt = shot.prompt || shot.Scene || '';
      }
      
      if (!combinedPrompt || combinedPrompt.trim() === '') {
        console.error('⚠️ Empty prompt detected in shot:', shot);
        throw new Error('Shot prompt cannot be empty');
      }
      
      // Wrap with content policy disclaimer
      return {
        prompt: `${CONTENT_POLICY_DISCLAIMER}${combinedPrompt}`,
        duration: shot.duration
      };
    }) : [
      {
        prompt: `${CONTENT_POLICY_DISCLAIMER}${prompt || ''}`,
        duration: duration
      }
    ];

    console.log('📋 Prepared shots:', shotsArray.map((s: any) => ({
      prompt_length: s.prompt?.length || 0,
      duration: s.duration
    })));

    // Kie.ai API requires TOTAL video duration to be 10, 15, or 25 seconds
    // We must distribute this across all scenes
    const allowedTotalDurations = [10, 15, 25];
    const numShots = shotsArray.length;
    
    // Pick the best total duration (prefer 25s for more scenes, or user's choice if single scene)
    let targetTotalDuration: number;
    if (numShots === 1) {
      // Single scene: use user-selected duration directly
      targetTotalDuration = allowedTotalDurations.includes(duration) ? duration : 10;
    } else {
      // Multi-scene: use maximum (25s) to give each scene more time
      targetTotalDuration = 25;
    }
    
    // Calculate duration per scene (must be at least 1 second per Kie.ai requirements)
    const baseDuration = Math.floor(targetTotalDuration / numShots);
    
    if (baseDuration < 1) {
      throw new Error(`Too many scenes (${numShots}) for ${targetTotalDuration}s total. Maximum ${targetTotalDuration} scenes allowed.`);
    }
    
    // Distribute remaining seconds to first shots
    let remaining = targetTotalDuration - (baseDuration * numShots);
    
    shotsArray.forEach((shot: any, index: number) => {
      if (remaining > 0) {
        shot.duration = baseDuration + 1;
        remaining--;
      } else {
        shot.duration = baseDuration;
      }
    });
    
    // Verify total matches exactly
    const actualTotal = shotsArray.reduce((sum: number, shot: any) => sum + shot.duration, 0);

    console.log('📊 Duration info:', {
      shots_count: numShots,
      target_total_duration: targetTotalDuration,
      base_per_scene: baseDuration,
      individual_durations: shotsArray.map((s: any) => s.duration),
      actual_total: actualTotal
    });

    // Build request payload with input wrapper (matching sora-extend-next format)
    const requestPayload = {
      model: 'sora-2-pro-storyboard',
      callBackUrl: callbackUrl,
      input: {
        n_frames: targetTotalDuration.toString(), // TOTAL video duration (10, 15, or 25)
        aspect_ratio: aspect_ratio === '16:9' ? 'landscape' : 'portrait',
        remove_watermark: watermark ? false : true,
        shots: shotsArray.map((shot: any) => ({
          Scene: shot.prompt,
          duration: shot.duration
        })),
        ...(image_url ? { image_urls: [image_url] } : {}),
      }
    };

    console.log('🚀 Sending to Kie.ai:', {
      model: requestPayload.model,
      callBackUrl: requestPayload.callBackUrl,
      input: {
        n_frames: requestPayload.input.n_frames,
        aspect_ratio: requestPayload.input.aspect_ratio,
        remove_watermark: requestPayload.input.remove_watermark,
        shots: requestPayload.input.shots.map((s: any) => ({
          Scene_preview: s.Scene?.substring(0, 80) + '...',
          duration: s.duration,
        })),
        image_urls: requestPayload.input.image_urls || 'none'
      }
    });

    // Call Kie.ai Sora 2 Pro API with correct format
    const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error('❌ Kie.ai API error:', kieResponse.status, errorText);
      
      const parsedError = parseKieError(kieResponse.status, errorText);
      
      // Update database with error
      await supabase
        .from('kie_video_generations')
        .update({
          initial_status: 'failed',
          initial_error: parsedError.message,
          metadata: { error_type: parsedError.type }
        })
        .eq('id', generation_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: parsedError.message,
          error_type: parsedError.type 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const result = await kieResponse.json();
    console.log('✅ Kie.ai response:', JSON.stringify(result, null, 2));
    
    // Check if API returned an error in the payload (even with 200 status)
    if (result.code && result.code !== 200) {
      const errorMsg = result.msg || 'Unknown API error';
      console.error('❌ Kie.ai API error in response:', result.code, errorMsg);
      
      const parsedError = parseKieError(result.code, errorMsg);
      
      await supabase
        .from('kie_video_generations')
        .update({
          initial_status: 'failed',
          initial_error: parsedError.message,
          metadata: { error_type: parsedError.type, api_response: result }
        })
        .eq('id', generation_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: parsedError.message,
          error_type: parsedError.type 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    
    const taskId = result.data?.taskId;
    if (!taskId) {
      throw new Error('No taskId received from Kie.ai API');
    }

    console.log('📝 Task ID:', taskId);

    // Update database with task ID and status
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update({
        initial_task_id: taskId,
        initial_status: 'generating',
        sora_model: 'sora-2-pro-storyboard',
        duration: targetTotalDuration, // Total video duration
        audio_enabled: audio_enabled,
        resolution: '1080p'
      })
      .eq('id', generation_id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    console.log('✅ Database updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        task_id: taskId 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('❌ Error in sora-generate-video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
