import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

// Enhanced error parsing
const parseKieError = (status: number, errorText: string) => {
  const lowerError = errorText.toLowerCase();
  
  if (lowerError.includes('credit') || lowerError.includes('insufficient') || lowerError.includes('balance')) {
    return {
      type: 'CREDIT_EXHAUSTED',
      message: 'Insufficient Kie.ai credits. Please add more credits to your account.',
      userAction: 'Add credits to your Kie.ai account to continue generating videos.'
    };
  }
  
  if (status === 429 || lowerError.includes('rate limit')) {
    return {
      type: 'RATE_LIMITED',
      message: 'Kie.ai rate limit exceeded. Please wait a few minutes.',
      userAction: 'Wait 5-10 minutes before trying again.'
    };
  }
  
  if (status === 401 || status === 403) {
    return {
      type: 'AUTH_ERROR',
      message: 'Invalid or expired Kie.ai API token.',
      userAction: 'Check your API token configuration.'
    };
  }
  
  return {
    type: 'API_ERROR',
    message: `Kie.ai API error (${status})`,
    userAction: 'Please try again. If the issue persists, check Kie.ai service status.'
  };
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

    const { generation_id, scene_prompt, scene_script, retry } = await req.json();

    console.log('📥 Sora2 extend request:', { generation_id, retry });

    // Get generation record
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      throw new Error('Generation not found');
    }

    // Get API key
    const KIE_AI_API_TOKEN = Deno.env.get('KIE_AI_API_TOKEN');
    if (!KIE_AI_API_TOKEN) {
      throw new Error('KIE_AI_API_TOKEN not configured');
    }

    const currentScene = generation.current_scene || 1;
    const totalScenes = generation.number_of_scenes || 1;
    const duration = generation.duration || 10;
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sora2-callback`;

    // Get scene data
    const sceneIndex = currentScene - 1;
    const currentSceneData = generation.scene_prompts?.[sceneIndex] || {};
    const previousSceneData = sceneIndex > 0 ? generation.scene_prompts?.[sceneIndex - 1] : null;
    
    const scenePrompt = scene_prompt || currentSceneData.prompt || '';
    const script = scene_script || currentSceneData.script || '';
    const connectsFromPrevious = previousSceneData?.connects_to_next || '';
    
    // Get avatar identity prefix stored from first scene generation
    const avatarIdentityPrefix = generation.avatar_identity_prefix || '';
    
    // Voice continuity requirements for consistent audio across scenes
    const voiceContinuityBlock = `VOICE CONTINUITY (MANDATORY FOR SCENE ${currentScene}):
This scene's voice MUST match Scene 1 exactly:
- Same voice pitch and timbre as established in Scene 1
- Same speaking pace and rhythm
- Same warmth and energy level
- Same accent and pronunciation style
- NO sudden changes in voice character

VOICE CHARACTER - ${generation.avatar_name}'s voice must be:
- Tone: Warm, confident, conversational - NOT robotic or monotone
- Clarity: Crystal clear articulation, every word distinct
- Pace: Natural rhythm with appropriate pauses
- Energy: Professional enthusiasm, not salesy
- Authenticity: Real ${generation.industry} professional, not text-to-speech

ANTI-ROBOTIC RULES:
✗ NO monotone delivery - vary pitch naturally
✗ NO rushed speech - natural pauses between sentences
✗ NO mechanical cadence - avoid evenly-spaced words
✗ NO over-enunciation - speak conversationally

NATURAL SPEECH PATTERNS:
✓ Brief pauses after important points
✓ Emphasis on key benefit words
✓ Warm smile in the voice
✓ Natural breath between sentences
✓ Conversational contractions (don't, we're, you'll)

`;
    
    // Build full prompt with avatar identity prefix and strong continuity instructions
    let fullPrompt = '';
    
    if (avatarIdentityPrefix) {
      // Use the stored avatar identity for consistent appearance
      fullPrompt = `${avatarIdentityPrefix}
${voiceContinuityBlock}
=== CRITICAL VISUAL CONTINUITY FOR SCENE ${currentScene} OF ${totalScenes} ===

This is a DIRECT CONTINUATION from the previous scene. The video must feel like ONE continuous recording:

MANDATORY CONSISTENCY RULES:
1. ${generation.avatar_name} looks EXACTLY the same as Scene 1 - same clothes, same hair, same accessories
2. The setting/location must match or logically extend from previous scenes
3. Lighting should remain consistent with the overall video
4. Camera style continues the established visual language
5. NO wardrobe changes, NO location jumps, NO time skips unless explicitly stated

${connectsFromPrevious ? `TRANSITION FROM PREVIOUS SCENE:
${connectsFromPrevious}

` : ''}SCENE ${currentScene} ACTION:
${scenePrompt}`;
    } else {
      // Fallback if no avatar prefix stored
      fullPrompt = `${voiceContinuityBlock}
=== SCENE ${currentScene} OF ${totalScenes} - DIRECT CONTINUATION ===

CRITICAL: This scene MUST maintain EXACT visual consistency with previous scenes:
- Same person (${generation.avatar_name}) with IDENTICAL appearance - same clothes, hair, accessories
- Same location and setting as established in Scene 1
- Smooth, seamless transition from the previous scene
- NO wardrobe changes, NO dramatic lighting changes, NO time jumps
- Camera style remains consistent with the established visual language

${connectsFromPrevious ? `TRANSITION FROM PREVIOUS SCENE:
${connectsFromPrevious}

` : ''}SCENE ${currentScene} ACTION:
${scenePrompt}`;
    }
    
    // Add dialogue with enhanced delivery instructions
    if (script) {
      const sceneType = currentScene === totalScenes ? 'Final' : 'Middle';
      const deliveryNote = currentScene === totalScenes 
        ? 'Warm invitation in the call-to-action, not aggressive sales pitch. End with friendly, welcoming tone.'
        : 'Confident but not pushy when explaining benefits. Maintain same energy level as previous scenes.';
      
      fullPrompt = `${fullPrompt}

AVATAR SPEECH DELIVERY:
${generation.avatar_name} speaks with the EXACT SAME voice as previous scenes - warm, professional, NOT robotic:
"${script}"

${sceneType} Scene Voice Notes:
- ${deliveryNote}
- Deliver naturally as if continuing the same conversation
- Pause briefly between sentences for clarity
- Match the speaking style and energy from Scene 1`;
    }

    console.log(`🎬 Generating scene ${currentScene}/${totalScenes} with duration ${duration}s`);
    console.log(`📝 Using avatar prefix: ${avatarIdentityPrefix ? 'YES' : 'NO'}`);
    console.log(`🔗 Previous scene transition: ${connectsFromPrevious || 'none'}`);

    // Sanitize prompt/script to avoid Google Veo policy violations
    const sanitizeForVeo = (text: string): string => {
      const blockedTerms = [
        /\b(kill|murder|attack|weapon|gun|knife|blood|death|die|dying|violent|fight|wound|injure)\b/gi,
        /\b(sexy|nude|naked|intimate|sexual|sensual|erotic|seductive)\b/gi,
        /\b(hate|racist|discrimination|slur|offensive|bigot)\b/gi,
        /\b(damn|hell|ass|crap)\b/gi,
        /\b(child|kid|minor|teenager|teen|youth|juvenile|underage)\b/gi,
        /\b(Trump|Biden|Obama|Putin|Musk|Zuckerberg|Bezos|celebrity)\b/gi,
        /\b(church|mosque|temple|priest|pastor|minister|imam|rabbi|religious|spiritual|divine|blessed|holy|sacred)\b/gi,
        /\b(drug|cocaine|heroin|meth|marijuana|weed|drunk|alcohol|beer|wine|vodka)\b/gi,
      ];
      
      let sanitized = text;
      blockedTerms.forEach(regex => {
        sanitized = sanitized.replace(regex, '');
      });
      
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
      
      if (sanitized !== text) {
        console.log('⚠️ Content sanitized for Veo policy compliance');
      }
      
      return sanitized;
    };

    // Apply sanitization and wrap with content policy disclaimer
    const sanitizedPrompt = sanitizeForVeo(fullPrompt);
    const safeFullPrompt = `${CONTENT_POLICY_DISCLAIMER}${sanitizedPrompt}`;
    // Build request payload for sora-2-pro-image-to-video
    const requestPayload = {
      model: 'sora-2-pro-image-to-video',
      callBackUrl: callbackUrl,
      input: {
        prompt: safeFullPrompt,
        image_urls: [generation.image_url],
        aspect_ratio: generation.aspect_ratio === '16:9' ? 'landscape' : 'portrait',
        n_frames: duration.toString(),
        size: 'standard',
        remove_watermark: generation.watermark ? false : true
      }
    };

    console.log('🚀 Calling Kie.ai API for scene extension...');

    // Call Kie.ai API
    const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_AI_API_TOKEN}`
      },
      body: JSON.stringify(requestPayload)
    });

    // Handle credit/error responses that return 200 with error in body
    const kieData = await kieResponse.json();
    console.log('📦 Kie.ai response:', JSON.stringify(kieData, null, 2));

    // Check for error codes in response body (e.g., 402 for insufficient credits)
    if (kieData.code && kieData.code !== 200) {
      const errorText = kieData.msg || 'Unknown error';
      const parsedError = parseKieError(kieData.code, errorText);
      
      console.error('❌ Kie.ai API error in response:', {
        code: kieData.code,
        msg: kieData.msg,
        parsed: parsedError
      });

      // Update generation with error
      await supabase
        .from('kie_video_generations')
        .update({
          extended_status: 'failed',
          extended_error: `Scene ${currentScene} failed: ${parsedError.message}`,
          metadata: { 
            error_type: parsedError.type,
            failed_scene: currentScene
          }
        })
        .eq('id', generation_id);

      return new Response(JSON.stringify({
        success: false,
        error: parsedError.message,
        error_type: parsedError.type,
        user_action: parsedError.userAction
      }), {
        status: 200, // Return 200 to prevent callback retry loops
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!kieResponse.ok) {
      const errorText = JSON.stringify(kieData);
      const parsedError = parseKieError(kieResponse.status, errorText);
      
      console.error('❌ Kie.ai HTTP error:', {
        status: kieResponse.status,
        error: errorText,
        parsed: parsedError
      });

      // Update generation with error
      await supabase
        .from('kie_video_generations')
        .update({
          extended_status: 'failed',
          extended_error: `Scene ${currentScene} failed: ${parsedError.message}`,
          metadata: { 
            error_type: parsedError.type,
            failed_scene: currentScene
          }
        })
        .eq('id', generation_id);

      return new Response(JSON.stringify({
        success: false,
        error: parsedError.message,
        error_type: parsedError.type,
        user_action: parsedError.userAction
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract task ID (kieData already parsed above)
    const data = kieData.data || kieData;
    const taskId = data.taskId || data.task_id || kieData.taskId || kieData.task_id;

    if (!taskId) {
      throw new Error('No task ID returned from Kie.ai');
    }

    // Update generation with new task ID
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update({
        extended_task_id: taskId,
        extended_status: 'generating'
      })
      .eq('id', generation_id);

    if (updateError) {
      console.error('❌ Failed to update generation:', updateError);
      throw updateError;
    }

    console.log('✅ Scene extension started with task ID:', taskId);

    return new Response(JSON.stringify({
      success: true,
      task_id: taskId,
      message: `Scene ${currentScene} generation started`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in sora2-extend-next:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Extension failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
