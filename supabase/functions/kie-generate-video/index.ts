import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Content policy disclaimer to avoid Google Veo rejections
// const CONTENT_POLICY_DISCLAIMER = `IMPORTANT DISCLAIMER: This scene features a fully fictional, AI-generated virtual presenter avatar.
// This character does not represent any real person, living or deceased.
// A generic virtual presenter appears in a non-identifiable professional setting,
// demonstrating and explaining general concepts in an educational manner.

// SCENE CONTENT:
// `;

const CONTENT_POLICY_DISCLAIMER = `
IMPORTANT DISCLAIMER:

The content is high-level, neutral, and educational in nature.
It does not provide financial, legal, medical, or professional advice,
and does not make promises, guarantees, or persuasive claims.

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { generation_id, prompt, image_url, model, aspect_ratio, watermark, avatar_name, industry, script, generation_type } = await req.json();

    const KIE_AI_TOKEN = Deno.env.get('KIE_AI_API_TOKEN');
    if (!KIE_AI_TOKEN) {
      throw new Error('KIE_AI_API_TOKEN not configured');
    }

    // Determine generation type - default to REFERENCE_2_VIDEO for backward compatibility
    const generationType = generation_type || (image_url && image_url !== 'text-to-video' ? 'REFERENCE_2_VIDEO' : 'TEXT_2_VIDEO');

    console.log('🎬 Starting Kie.ai video generation:', { generation_id, model, aspect_ratio, generationType });

    // Prepare callback URL for Kie.ai to send completion notification
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/kie-callback`;

    // Voice identity for natural, non-robotic speech delivery
    const voiceIdentityBlock = `VOICE & SPEECH REQUIREMENTS (CRITICAL FOR NATURAL AUDIO):

VOICE CHARACTER${avatar_name ? ` - ${avatar_name}'s voice` : ''} must be:
- Tone: Warm, confident, and genuinely conversational - like speaking to a trusted colleague
- Clarity: Crystal clear articulation, every word distinctly pronounced
- Pace: Natural speaking rhythm with appropriate pauses between thoughts
- Energy: Professional enthusiasm without sounding salesy or robotic
- Authenticity: Sounds like a real${industry ? ` ${industry}` : ''} professional, not a text-to-speech bot

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

`;

    // Build enhanced prompt with voice instructions
    let enhancedPrompt = `${voiceIdentityBlock}${prompt}`;
    
    // Add dialogue delivery instructions if script is provided
    if (script) {
      enhancedPrompt = `${enhancedPrompt}

AVATAR SPEECH DELIVERY:
${avatar_name || 'The presenter'} speaks with a warm, professional tone - NOT robotic or monotone:
"${script}"

Voice Delivery Notes:
- Deliver naturally as if explaining to a friend
- Pause briefly between sentences for clarity
- Slight emphasis on key benefit words
- Build connection - speak directly TO the viewer`;
    }

    // Wrap prompt with content policy disclaimer
    const safePrompt = `${CONTENT_POLICY_DISCLAIMER}${enhancedPrompt}`;

    // Build request payload - conditionally include imageUrls based on generation type
    const requestPayload: Record<string, unknown> = {
      prompt: safePrompt,
      model: model || 'veo3_fast',
      watermark: watermark || '',
      callBackUrl: callbackUrl,
      aspectRatio: aspect_ratio || '16:9',
      enableFallback: false,
      enableTranslation: true,
      generationType: generationType
    };

    // Only include imageUrls for image-to-video mode
    if (generationType === 'REFERENCE_2_VIDEO' && image_url && image_url !== 'text-to-video') {
      requestPayload.imageUrls = [image_url];
    }

    console.log('📤 Kie.ai request payload:', JSON.stringify({ ...requestPayload, prompt: '[TRUNCATED]' }, null, 2));

    // Call Kie.ai generate endpoint
    const kieResponse = await fetch('https://api.kie.ai/api/v1/veo/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload)
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      const parsedError = parseKieError(kieResponse.status, errorText);
      
      console.error('❌ Kie.ai API error:', {
        status: kieResponse.status,
        errorText,
        parsed: parsedError
      });
      
      // Update DB with detailed error
      await supabase
        .from('kie_video_generations')
        .update({
          initial_status: 'failed',
          initial_error: `${parsedError.message}\n\nDetails: ${errorText}`,
          metadata: { 
            error_type: parsedError.type,
            error_raw: errorText,
            error_status: kieResponse.status,
            error_timestamp: new Date().toISOString()
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

    const kieData = await kieResponse.json();
    console.log('📦 Raw Kie.ai response:', JSON.stringify(kieData, null, 2));
    
    const taskId = kieData.taskId || kieData.task_id || kieData.data?.taskId || kieData.data?.task_id;

    if (!taskId) {
      console.error('❌ No task ID found in response. Full response:', JSON.stringify(kieData, null, 2));
      throw new Error('No task ID returned from Kie.ai');
    }

    console.log('✅ Kie.ai task created:', taskId);

    // Update database with task ID and status
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update({
        initial_task_id: taskId,
        initial_status: 'generating',
        metadata: { 
          full_response: kieData,
          extracted_task_id: taskId,
          generation_type: generationType
        }
      })
      .eq('id', generation_id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({
      success: true,
      task_id: taskId,
      message: 'Video generation started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in kie-generate-video:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start video generation'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
