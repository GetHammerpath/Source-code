import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { generation_id, scene_prompt } = await req.json();

    console.log('📥 Manual extend request for generation:', generation_id);

    // Get generation record
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      throw new Error('Generation not found');
    }

    // Validate that we have segments and last one is completed
    const segments = generation.video_segments || [];
    if (segments.length === 0) {
      throw new Error('No video segments found');
    }

    // Get the last task ID from the most recent segment
    const lastTaskId = generation.extended_task_id || generation.initial_task_id;
    
    if (!lastTaskId) {
      throw new Error('No previous task ID found');
    }

    console.log('📋 Current segments:', segments.length);
    console.log('🔗 Last task ID:', lastTaskId);

    // Determine duration: Scene 1 = 8s, Scenes 2+ = 6s
    const isFirstScene = generation.current_scene === 1;
    const duration = isFirstScene ? 8 : 6;
    const actionDuration = duration - 1;  // Complete action 1s before end
    const slowDownStart = duration - 3;    // Start slowing 3s before end
    const settleStart = duration - 2;      // Settle 2s before end
    const freezeStart = duration - 1;      // Freeze 1s before end

    console.log(`⏱️ Scene ${generation.current_scene} duration: ${duration} seconds`);

    // Voice continuity requirements for consistent audio across scenes
    const voiceContinuityBlock = `VOICE CONTINUITY (MANDATORY):
This scene's voice MUST match previous scenes exactly:
- Same voice pitch and timbre as Scene 1
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
✗ NO monotone - vary pitch naturally
✗ NO rushed speech - natural pauses
✗ NO mechanical cadence - avoid evenly-spaced words
✗ NO over-enunciation - speak conversationally

NATURAL SPEECH:
✓ Pauses after important points
✓ Emphasis on key words
✓ Warm smile in voice
✓ Natural breath between sentences
✓ Contractions (don't, we're, you'll)

`;

    // Use custom scene prompt if provided, otherwise build contextual prompt
    let extensionPrompt: string;
    
    if (scene_prompt) {
      // Get the script for this scene from scene_prompts
      const currentSceneData = generation.scene_prompts?.[generation.current_scene - 1];
      const currentScript = currentSceneData?.script || '';

      // Multi-scene: HARD-CUT OPTIMIZED with freeze-frame ending
      extensionPrompt = `${voiceContinuityBlock}SEAMLESS VIDEO CONTINUATION - HARD-CUT OPTIMIZED:

**CRITICAL: This segment will be DIRECTLY CONCATENATED to previous video**
**Goal: Minimize visible "jump" at transition point**
**Duration: ${duration} seconds total**

1. **STARTING POSITION MATCH - ABSOLUTE**:
   - ${generation.avatar_name} MUST start in EXACT position/pose from previous scene end
   - Same camera distance, same body orientation, same height level
   - NO sudden position changes or "teleporting"
   - Avatar should appear to be in continuous motion from previous scene
   - Match previous end pose EXACTLY before beginning new action

2. **CAMERA LOCK - CRITICAL**:
   - Camera FROZEN in exact same position throughout entire ${duration} seconds
   - ZERO camera movement: no pans, tilts, zooms, dollies, or angle shifts
   - Camera acts as if bolted to tripod
   - Only the avatar moves, camera is STATIONARY OBSERVER

3. **MOVEMENT CONSTRAINTS**:
   - Keep ${generation.avatar_name} within 3-foot radius throughout scene
   - NO walking across frame or large position changes
   - Rotate body, shift weight, move arms - but stay in same spot
   - All movements should be SLOW and DELIBERATE (no fast gestures)
   - Position relative to background element (e.g., ladder, wall, vehicle) stays consistent

4. **ENDING PROTOCOL - CRITICAL FOR NEXT SEGMENT**:
   - Seconds 0-${slowDownStart}: Normal action/dialogue for scene
   - Seconds ${slowDownStart}-${settleStart}: BEGIN SLOWING DOWN all movements
   - Seconds ${settleStart}-${freezeStart}: SETTLE into stable neutral pose
   - Seconds ${freezeStart}-${duration}: HOLD nearly still (breathing-level movement only)
   - Final pose MUST be: Standing/sitting upright, facing camera, hands at sides or resting on tool
   - This creates a stable "anchor point" for next segment to match

5. **AUDIO TIMING - PREVENTS MID-WORD CUTS**:
   - Begin speaking naturally in first 1-2 seconds
   - COMPLETE ALL DIALOGUE by second ${actionDuration} (NOT after second ${actionDuration})
   - Final ${duration - actionDuration} seconds: SILENT with ambient sound only
   - This prevents jarring mid-sentence audio cuts at transition

6. **VISUAL ANCHORING**:
   - Position ${generation.avatar_name} relative to specific background element
   - Example: "Left shoulder aligned with ladder" or "Standing 2 feet from truck door"
   - Maintain this spatial relationship throughout scene
   - Creates visual continuity reference point

7. **AVATAR VISUAL CONTINUITY**:
   - ${generation.avatar_name} MUST appear identical (same person, appearance, clothing)
   - Same lighting and shadow direction
   - No sudden brightness/shadow changes in final ${duration - actionDuration} seconds

8. **Scene-Specific Action**:
${scene_prompt}

${currentScript ? `\n9. **AVATAR SPEECH DELIVERY**:
${generation.avatar_name} speaks with the EXACT SAME voice as previous scenes - warm, professional, NOT robotic:
"${currentScript}"

Voice Delivery Notes:
- Match the voice character established in Scene 1
- Deliver naturally, pause between sentences
- Complete speaking by second ${actionDuration}
- Final ${duration - actionDuration} seconds: SILENT settling` : ''}

${currentScript ? '10' : '9'}. **Technical Consistency**:
   - Match lighting from previous scene
   - Keep background elements in same position
   - Preserve time-of-day appearance

**SUMMARY**: Start matching previous end pose, move minimally within small area, end in stable neutral position ready for next segment. Camera NEVER moves. Last ${duration - actionDuration} seconds are settling/freeze-frame.`;

      console.log('🎬 Enhanced scene prompt with transition bridging');
      console.log('📝 Scene action:', scene_prompt.substring(0, 100) + '...');
    } else {
      // Single scene extension - HARD-CUT OPTIMIZED
      const originalPrompt = generation.ai_prompt || '';
      const promptContext = originalPrompt.substring(0, 200);
      
      extensionPrompt = `${voiceContinuityBlock}SEAMLESS VIDEO CONTINUATION - HARD-CUT OPTIMIZED:

**CRITICAL: Direct concatenation - minimize visible "jump"**
**Duration: ${duration} seconds total**

1. **STARTING POSITION MATCH**:
   - ${generation.avatar_name} MUST start in EXACT position/pose from previous scene end
   - Same camera distance, same body orientation
   - NO sudden position changes or "teleporting"

2. **CAMERA LOCK - ABSOLUTE**:
   - Camera FROZEN in exact same position throughout ${duration} seconds
   - ZERO camera movement: no pans, tilts, zooms, or angle shifts
   - Only avatar moves, camera is STATIONARY

3. **MOVEMENT CONSTRAINTS**:
   - Keep ${generation.avatar_name} within 3-foot radius
   - NO walking across frame
   - Rotate body, shift weight, move arms - but stay in same spot
   - All movements SLOW and DELIBERATE

4. **ENDING PROTOCOL - FREEZE-FRAME**:
   - Seconds 0-${slowDownStart}: Normal action/dialogue
   - Seconds ${slowDownStart}-${settleStart}: BEGIN SLOWING DOWN movements
   - Seconds ${settleStart}-${freezeStart}: SETTLE into stable neutral pose
   - Seconds ${freezeStart}-${duration}: HOLD nearly still (breathing-level only)
   - Final pose: Standing/sitting upright, facing camera, hands at sides

5. **AUDIO TIMING**:
   - Begin speaking in first 1-2 seconds
   - COMPLETE speaking by second ${actionDuration}
   - Final ${duration - actionDuration} seconds: SILENT with ambient sound only

6. **VISUAL ANCHORING**:
   - Position relative to background element stays consistent
   - Same lighting and shadow direction

7. **Avatar & Voice Continuity**:
   - ${generation.avatar_name} (EXACT SAME PERSON - maintain appearance)
   - SAME VOICE as previous scenes - warm, professional, NOT robotic
   - Same lighting throughout, no sudden changes in final ${duration - actionDuration} seconds

Original context: "${promptContext}..."

**SUMMARY**: Match start pose, move minimally, end with stable freeze-frame. Camera NEVER moves. Last ${duration - actionDuration} seconds settling.`;
      
      console.log('🎬 Single-scene extension with continuity prompt');
    }

    // Call Kie.ai extend API
    const KIE_AI_API_TOKEN = Deno.env.get('KIE_AI_API_TOKEN');
    if (!KIE_AI_API_TOKEN) {
      throw new Error('KIE_AI_API_TOKEN not configured');
    }

    console.log('🎬 Calling Kie.ai extend API...');

    // Wrap prompt with content policy disclaimer
    const safeExtensionPrompt = `${CONTENT_POLICY_DISCLAIMER}${extensionPrompt}`;

    const kieResponse = await fetch('https://api.kie.ai/api/v1/veo/extend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_AI_API_TOKEN}`
      },
      body: JSON.stringify({
        taskId: lastTaskId,
        prompt: safeExtensionPrompt,
        duration: duration,
        callBackUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/kie-callback`,
        watermark: generation.watermark || ''
      })
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      const parsedError = parseKieError(kieResponse.status, errorText);
      
      console.error('❌ Kie.ai extend error:', {
        generation_id,
        scene: generation.current_scene,
        status: kieResponse.status,
        errorText,
        parsed: parsedError
      });
      
      // Update with scene-specific error context
      await supabase
        .from('kie_video_generations')
        .update({
          extended_status: 'failed',
          extended_error: `Scene ${generation.current_scene} failed: ${parsedError.message}\n\nDetails: ${errorText}`,
          metadata: { 
            error_type: parsedError.type,
            failed_scene: generation.current_scene,
            error_raw: errorText,
            error_timestamp: new Date().toISOString()
          }
        })
        .eq('id', generation_id);
        
      return new Response(JSON.stringify({
        success: false,
        error: parsedError.message,
        error_type: parsedError.type,
        user_action: parsedError.userAction,
        failed_scene: generation.current_scene
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const kieData = await kieResponse.json();
    console.log('📦 Kie.ai extend response:', JSON.stringify(kieData, null, 2));

    const data = kieData.data || kieData;
    const newTaskId = data.taskId || data.task_id || kieData.taskId || kieData.task_id;

    if (!newTaskId) {
      throw new Error('No task ID returned from Kie.ai');
    }

    // Update database
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update({
        extended_task_id: newTaskId,
        extended_status: 'generating'
      })
      .eq('id', generation_id);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Extension started successfully with task ID:', newTaskId);

    return new Response(JSON.stringify({
      success: true,
      task_id: newTaskId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in kie-extend-next:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Extension failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
