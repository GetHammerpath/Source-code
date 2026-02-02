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

NO ON-SCREEN TEXT: NO captions, subtitles, text overlays, signs, or visible written words. Dialogue is audio only.

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
  
  if (lowerError.includes('invalid') || lowerError.includes('parameter')) {
    return {
      type: 'INVALID_PARAMS',
      message: 'Invalid generation parameters.',
      userAction: 'Check your video settings and try again.'
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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    );

    const {
      user_id,
      image_url,
      industry,
      avatar_name,
      city,
      story_idea,
      scene_prompts,
      aspect_ratio,
      watermark,
      duration,
      image_analysis,
      model
    } = await req.json();

    console.log('📥 Sora2 Latest generation request:', {
      user_id,
      industry,
      avatar_name,
      city,
      scene_count: scene_prompts?.length,
      aspect_ratio,
      duration
    });

    // Validate required fields
    if (!user_id || !image_url || !scene_prompts?.length) {
      throw new Error('Missing required fields: user_id, image_url, scene_prompts');
    }

    // Credit check (model-aware, must match src/lib/video-models.ts)
    const creditsPerSegment: Record<string, number> = {
      sora2_pro_720: 1,
      sora2_pro_1080: 2,
    };
    const modelId = (model as string) || 'sora2_pro_720';
    const rate = creditsPerSegment[modelId] ?? 1;
    const requiredCredits = Math.ceil(scene_prompts.length * rate);
    const { data: balance, error: balanceError } = await supabase
      .from('credit_balance')
      .select('credits')
      .eq('user_id', user_id)
      .single();
    if (balanceError || (balance?.credits ?? 0) < requiredCredits) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Insufficient credits. You need ${requiredCredits} credits for ${scene_prompts.length} scene(s).`,
          error_type: 'CREDIT_EXHAUSTED',
          user_action: 'Add more credits to continue.',
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate duration (must be 10, 15, or 25)
    const validDurations = [10, 15, 25];
    const validDuration = validDurations.includes(duration) ? duration : 10;

    // Build avatar identity prefix from image analysis for consistent appearance across scenes
    let avatarIdentityPrefix = '';
    if (image_analysis) {
      const avatar = image_analysis.avatar_appearance || {};
      const clothing = image_analysis.clothing_details || {};
      const environment = image_analysis.environment || {};
      
      avatarIdentityPrefix = `CRITICAL AVATAR IDENTITY - THIS EXACT PERSON MUST APPEAR IDENTICALLY IN EVERY SCENE:
Character: ${avatar_name}
- Physical: ${avatar.gender || 'Person'}, ${avatar.age_range || 'adult'}, ${avatar.build || 'average build'}
- Hair: ${avatar.hair_description || 'natural hair'}
- Face: ${avatar.skin_tone || 'natural'} skin, ${avatar.facial_features || 'natural features'}
- Clothing: ${clothing.top || 'professional attire'}${clothing.bottom ? ', ' + clothing.bottom : ''}
- Accessories: ${clothing.accessories?.join(', ') || 'none visible'}
- Industry: ${industry} professional, ${avatar.demeanor || 'confident and friendly'}

ENVIRONMENT CONSISTENCY:
- Setting: ${environment.location_type || 'professional setting'}, ${environment.specific_elements?.join(', ') || 'work environment'}
- Lighting: ${environment.lighting || 'natural lighting'}

THIS EXACT PERSON with these EXACT clothing and features must appear in this scene with NO changes to appearance.

`;
    }

    console.log('🎭 Built avatar identity prefix:', avatarIdentityPrefix.substring(0, 200) + '...');

    // Create generation record with avatar identity prefix
    const { data: generation, error: insertError } = await supabase
      .from('kie_video_generations')
      .insert({
        user_id,
        image_url,
        industry,
        avatar_name,
        city,
        story_idea,
        ai_prompt: scene_prompts[0]?.prompt || '',
        scene_prompts,
        number_of_scenes: scene_prompts.length,
        current_scene: 1,
        is_multi_scene: scene_prompts.length > 1,
        aspect_ratio,
        watermark: watermark || null,
        duration: validDuration,
        sora_model: 'sora-2-pro-image-to-video',
        model: modelId,
        initial_status: 'generating',
        video_segments: [],
        avatar_identity_prefix: avatarIdentityPrefix // Store for use in subsequent scenes
      })
      .select()
      .single();

    if (insertError || !generation) {
      console.error('❌ Failed to create generation record:', insertError);
      throw new Error('Failed to create generation record');
    }

    console.log('📝 Created generation record:', generation.id);

    // Reserve credits (create video_job)
    const estimatedMinutes = (scene_prompts.length * (validDuration || 10)) / 60;
    await supabase.from('video_jobs').insert({
      user_id,
      generation_id: generation.id,
      provider: 'kie-sora2',
      estimated_minutes: estimatedMinutes,
      estimated_credits: requiredCredits,
      credits_reserved: requiredCredits,
      status: 'pending',
      metadata: { model: modelId, scene_count: scene_prompts.length },
    });

    // Get API key
    const KIE_AI_API_TOKEN = Deno.env.get('KIE_AI_API_TOKEN');
    if (!KIE_AI_API_TOKEN) {
      throw new Error('KIE_AI_API_TOKEN not configured');
    }

    // Voice identity for natural, non-robotic speech delivery
    // Scene 1 establishes the voice - subsequent scenes must match this exactly for consistency
    const voiceIdentityPrefix = `VOICE & SPEECH REQUIREMENTS (CRITICAL - ESTABLISHES VOICE FOR ALL SCENES):

VOICE FINGERPRINT: This scene establishes ${avatar_name}'s voice. All subsequent scenes MUST use this EXACT same voice - same pitch, timbre, accent, and tone. Consistency across scenes is mandatory.

VOICE CHARACTER - ${avatar_name}'s voice must be:
- Tone: Warm, confident, and genuinely conversational - like speaking to a trusted colleague
- Clarity: Crystal clear articulation, every word distinctly pronounced
- Pace: Natural speaking rhythm with appropriate pauses between thoughts
- Energy: Professional enthusiasm without sounding salesy or robotic
- Authenticity: Sounds like a real ${industry} professional, not a text-to-speech bot

ANTI-ROBOTIC RULES (MANDATORY):
✗ NO monotone delivery - vary pitch naturally
✗ NO rushed speech - take natural pauses between sentences
✗ NO mechanical cadence - avoid evenly-spaced word delivery
✗ NO over-enunciation - speak conversationally, not like reading a script

NATURAL SPEECH PATTERNS:
✓ Brief pauses after important points
✓ Slight emphasis on key benefit words
✓ Warm smile in the voice (audible friendliness)
✓ Natural breath between sentences
✓ Conversational contractions (don't, we're, you'll, it's)

NO ON-SCREEN TEXT (MANDATORY):
- NO captions, subtitles, or text overlays
- NO visible text, titles, or graphics with words
- NO signs, labels, or written content in the scene
- Dialogue is audio only - never display spoken words as text on screen

`;

    // Build prompt for first scene with avatar identity prefix
    const firstScene = scene_prompts[0];
    let firstPrompt = firstScene.prompt;
    
    // Prepend avatar identity for consistency
    if (avatarIdentityPrefix) {
      firstPrompt = `${avatarIdentityPrefix}${voiceIdentityPrefix}SCENE 1 ACTION:\n${firstPrompt}`;
    } else {
      firstPrompt = `${voiceIdentityPrefix}SCENE 1 ACTION:\n${firstPrompt}`;
    }
    
    // Add dialogue with enhanced delivery instructions
    if (firstScene.script) {
      firstPrompt = `${firstPrompt}

AVATAR SPEECH DELIVERY:
${avatar_name} speaks with a warm, professional tone - NOT robotic or monotone:
"${firstScene.script}"

Voice Delivery Notes:
- Deliver naturally as if explaining to a friend
- Pause briefly between sentences for clarity
- Slight emphasis on key benefit words
- Open with engaging, slightly curious tone for the hook
- Build connection - speak directly TO the viewer`;
    }

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
      
      // Clean up extra spaces
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
      
      if (sanitized !== text) {
        console.log('⚠️ Content sanitized for Veo policy compliance');
      }
      
      return sanitized;
    };

    // Apply sanitization to prompt
    const sanitizedPrompt = sanitizeForVeo(firstPrompt);

    // Wrap with content policy disclaimer
    const safeFirstPrompt = `${CONTENT_POLICY_DISCLAIMER}${sanitizedPrompt}`;
    // Build callback URL
    const callbackUrl = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/sora2-callback`;

    // Build request payload for sora-2-pro-image-to-video
    const requestPayload = {
      model: 'sora-2-pro-image-to-video',
      callBackUrl: callbackUrl,
      input: {
        prompt: safeFirstPrompt,
        image_urls: [image_url],
        aspect_ratio: aspect_ratio === '16:9' ? 'landscape' : 'portrait',
        n_frames: validDuration.toString(),
        size: 'standard',
        remove_watermark: watermark ? false : true
      }
    };

    console.log('🚀 Calling Kie.ai API with payload:', JSON.stringify(requestPayload, null, 2));

    // Call Kie.ai API
    const kieResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_AI_API_TOKEN}`
      },
      body: JSON.stringify(requestPayload)
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      const parsedError = parseKieError(kieResponse.status, errorText);
      
      console.error('❌ Kie.ai API error:', {
        status: kieResponse.status,
        error: errorText,
        parsed: parsedError
      });

      // Update generation with error
      await supabase
        .from('kie_video_generations')
        .update({
          initial_status: 'failed',
          initial_error: `${parsedError.message}\n\nDetails: ${errorText}`,
          metadata: { error_type: parsedError.type }
        })
        .eq('id', generation.id);

      return new Response(JSON.stringify({
        success: false,
        error: parsedError.message,
        error_type: parsedError.type,
        user_action: parsedError.userAction
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const kieData = await kieResponse.json();
    console.log('📦 Kie.ai response:', JSON.stringify(kieData, null, 2));

    // Check for API-level error codes (Kie.ai returns 200 with error in body)
    if (kieData.code && kieData.code !== 200 && kieData.code !== 0) {
      const errorMsg = kieData.msg || 'Unknown Kie.ai error';
      const parsedError = parseKieError(kieData.code, errorMsg);
      
      console.error('❌ Kie.ai returned error in response body:', {
        code: kieData.code,
        msg: errorMsg,
        parsed: parsedError
      });

      // Update generation with error
      await supabase
        .from('kie_video_generations')
        .update({
          initial_status: 'failed',
          initial_error: `${parsedError.message}\n\nDetails: ${errorMsg}`,
          metadata: { error_type: parsedError.type, api_response: { code: kieData.code, msg: errorMsg } }
        })
        .eq('id', generation.id);

      return new Response(JSON.stringify({
        success: false,
        error: parsedError.message,
        error_type: parsedError.type,
        user_action: parsedError.userAction
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract task ID
    const data = kieData.data || kieData;
    const taskId = data.taskId || data.task_id || kieData.taskId || kieData.task_id;

    if (!taskId) {
      console.error('❌ No task ID in response:', kieData);
      throw new Error('No task ID returned from Kie.ai');
    }

    // Update generation with task ID
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update({
        initial_task_id: taskId,
        initial_status: 'generating'
      })
      .eq('id', generation.id);

    if (updateError) {
      console.error('❌ Failed to update generation:', updateError);
      throw updateError;
    }

    console.log('✅ Generation started successfully with task ID:', taskId);

    return new Response(JSON.stringify({
      success: true,
      generation_id: generation.id,
      task_id: taskId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in sora2-generate-video:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
