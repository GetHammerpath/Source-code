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

NO ON-SCREEN TEXT (MANDATORY):
- NO captions, subtitles, or text overlays
- NO visible text, titles, or graphics with words
- NO signs, labels, or written content in the scene
- Dialogue is AUDIO ONLY - never display spoken words as text on screen

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

  // Kie rejects script/audio that triggers their content filter (400 PUBLIC_ERROR_AUDIO_FILTERED)
  if (status === 400 && (lowerError.includes('audio_filtered') || lowerError.includes('public_error_audio_filtered'))) {
    return {
      type: 'AUDIO_FILTERED',
      message: 'The script or dialogue was filtered by Kie.ai. Their audio policy rejected some of the text.',
      userAction: 'Simplify the avatar script: use neutral, professional language; avoid medical/legal/financial claims, brand names, or sensitive terms. Try shorter dialogue or rephrase and generate again.'
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

// Resolve user from API key (Bearer duidui_xxx) for programmatic access to this platform
async function resolveApiKeyUser(
  authHeader: string,
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<{ id: string } | null> {
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  const validPrefix = bearer.startsWith('duidui_') || bearer.startsWith('kie_');
  if (!validPrefix || bearer.length < 12) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bearer));
  const keyHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const { data: row } = await supabaseAdmin
    .from('user_api_keys')
    .select('user_id')
    .eq('key_hash', keyHash)
    .single();
  if (!row?.user_id) return null;
  await supabaseAdmin.from('user_api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', keyHash);
  return { id: row.user_id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: No authorization header'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Allow service role for server-to-server calls (bulk-generate-videos, kie-retry-generation)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isServiceRole = !!serviceRoleKey && bearer === serviceRoleKey;

    // Use admin client for DB when called by other Edge Functions (bypasses RLS)
    const db = isServiceRole ? supabaseAdmin : supabase;

    // Resolve user: JWT or API key (Bearer duidui_xxx) or service role (uses generation's user_id later)
    const isApiKeyAuth = (h: string) => {
      const b = h.startsWith('Bearer ') ? h.slice(7).trim() : h;
      return b.startsWith('duidui_') || b.startsWith('kie_');
    };
    let user: { id: string } | null = isServiceRole ? null : await resolveApiKeyUser(authHeader, supabaseAdmin);
    if (!user && !isServiceRole) {
      const { data: { user: jwtUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !jwtUser) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Unauthorized: Invalid or missing authentication'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      user = jwtUser;
    }

    // If authenticated via API key, enforce api_access_allowed
    if (isApiKeyAuth(authHeader)) {
      const { data: limits } = await supabaseAdmin
        .from('user_limits')
        .select('api_access_allowed')
        .eq('user_id', user.id)
        .single();
      if (limits?.api_access_allowed === false) {
        return new Response(JSON.stringify({
          success: false,
          error: 'API access has been revoked for this account. Contact support.'
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const body = await req.json();
    const { generation_id, prompt, image_url, model, aspect_ratio, watermark, avatar_name, avatar_description, industry, script, generation_type } = body;

    // Validate required fields
    if (!generation_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required field: generation_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!prompt || prompt.trim() === '') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required field: prompt'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const KIE_AI_TOKEN = Deno.env.get('KIE_AI_API_TOKEN') || Deno.env.get('KIE_API_KEY');
    if (!KIE_AI_TOKEN) {
      console.error('❌ KIE_AI_API_TOKEN or KIE_API_KEY not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Server configuration error: Kie.ai API key not set'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the generation belongs to the authenticated user
    const { data: generation, error: genError } = await db
      .from('kie_video_generations')
      .select('user_id, initial_status')
      .eq('id', generation_id)
      .single();

    if (genError || !generation) {
      console.error('❌ Generation lookup error:', genError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Generation not found or access denied'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (isServiceRole) {
      user = { id: generation.user_id };
    }
    if (generation.user_id !== user!.id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized: This generation does not belong to you'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Determine generation type - default to REFERENCE_2_VIDEO for backward compatibility
    const generationType = generation_type || (image_url && image_url !== 'text-to-video' ? 'REFERENCE_2_VIDEO' : 'TEXT_2_VIDEO');

    console.log('🎬 Starting Kie.ai video generation:', { generation_id, model, aspect_ratio: aspect_ratio || '16:9', generationType, user_id: user.id });

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

    // Prepend avatar/spokesperson description so the video model uses it for visual consistency
    const avatarVisualBlock = (avatar_description && typeof avatar_description === 'string' && avatar_description.trim())
      ? `SPOKESPERSON VISUAL (use this description in the video): ${avatar_description.trim()}\n\n`
      : '';
    // Build enhanced prompt with voice instructions
    let enhancedPrompt = `${voiceIdentityBlock}${avatarVisualBlock}${prompt}`;
    
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

    // Normalize aspect ratio: support 16:9, 9:16; map Auto/invalid to 16:9
    const validAspectRatios = ['16:9', '9:16'];
    const aspectRatio = validAspectRatios.includes(aspect_ratio) ? aspect_ratio : '16:9';

    // Deterministic seed from generation_id for voice/visual consistency across scenes (Veo range: 10000-99999)
    const seedNum = Math.abs(
      Array.from(generation_id).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
    );
    const seed = (seedNum % 90000) + 10000;

    // Build request payload - conditionally include imageUrls based on generation type
    const requestPayload: Record<string, unknown> = {
      prompt: safePrompt,
      model: model || 'veo3_fast',
      watermark: watermark || '',
      callBackUrl: callbackUrl,
      aspectRatio,
      seeds: seed,
      enableFallback: false,
      enableTranslation: true,
      generationType: generationType
    };

    // Only include imageUrls for image-to-video mode
    if (generationType === 'REFERENCE_2_VIDEO' && image_url && image_url !== 'text-to-video') {
      requestPayload.imageUrls = [image_url];
    }

    console.log('📤 Kie.ai request payload:', JSON.stringify({ ...requestPayload, prompt: '[TRUNCATED]' }, null, 2));

    // Persist seed so extend calls can reuse it for voice consistency
    await db.from('kie_video_generations').update({ seeds: seed }).eq('id', generation_id);

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
      await db
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
    const { error: updateError } = await db
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

  } catch (error: unknown) {
    console.error('❌ Error in kie-generate-video:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start video generation';
    const statusCode = errorMessage.includes('Unauthorized') ? 401 : 
                      errorMessage.includes('Missing required') ? 400 : 500;
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
