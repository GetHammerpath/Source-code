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

NO ON-SCREEN TEXT: NO captions, subtitles, text overlays, signs, or visible written words. Dialogue is audio only.

SCENE CONTENT:
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      generation_id,
      previous_task_id,
      scene_number,
      scene_prompt,
      scene_script,
      scene_camera
    } = await req.json();

    console.log('Extending video for scene:', scene_number, 'generation:', generation_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const kieApiToken = Deno.env.get('KIE_AI_API_TOKEN');

    if (!kieApiToken) {
      throw new Error('KIE_AI_API_TOKEN is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the generation record
    const { data: generation, error: fetchError } = await supabase
      .from('runway_extend_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      throw new Error('Generation not found');
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
      
      sanitized = sanitized.replace(/\s+/g, ' ').trim();
      
      if (sanitized !== text) {
        console.log('⚠️ Content sanitized for Veo policy compliance');
      }
      
      return sanitized;
    };

    // Build the extension prompt with strong avatar continuity
    const basePrompt = `${generation.avatar_identity_prefix}

SCENE ${scene_number} - CONTINUATION:
${sanitizeForVeo(scene_prompt)}

CAMERA: ${scene_camera || 'Smooth continuation from previous shot'}

CRITICAL CONTINUITY INSTRUCTIONS:
- This scene CONTINUES DIRECTLY from the last frame of the previous scene
- The avatar MUST look IDENTICAL to the previous scene
- Maintain EXACT same clothing, lighting, and environment
- This is a SEAMLESS CONTINUATION, not a new video
- The person is THE SAME as in all previous scenes`;

    // Wrap with content policy disclaimer
    const fullPrompt = `${CONTENT_POLICY_DISCLAIMER}${basePrompt}`;

    const callbackUrl = `${supabaseUrl}/functions/v1/runway-extend-callback`;
    
    console.log('Calling Kie.ai Runway extend API with:', {
      taskId: previous_task_id,
      promptLength: fullPrompt.length,
      quality: generation.resolution === '1080p' && generation.duration_per_scene !== 10 ? '1080p' : '720p'
    });

    // Call Kie.ai Runway EXTEND API
    // Endpoint: /api/v1/runway/extend
    const kieResponse = await fetch('https://api.kie.ai/api/v1/runway/extend', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kieApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: previous_task_id,
        prompt: fullPrompt,
        quality: generation.resolution === '1080p' && generation.duration_per_scene !== 10 ? '1080p' : '720p',
        waterMark: '',
        callBackUrl: callbackUrl
      }),
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error('Kie.ai Extend API error:', kieResponse.status, errorText);
      
      // Update generation with error
      await supabase
        .from('runway_extend_generations')
        .update({ 
          extended_status: 'failed', 
          extended_error: `Kie.ai Extend API error: ${kieResponse.status}` 
        })
        .eq('id', generation_id);
      
      throw new Error(`Kie.ai Extend API error: ${kieResponse.status}`);
    }

    const kieData = await kieResponse.json();
    console.log('Kie.ai Extend response:', kieData);

    const newTaskId = kieData.data?.taskId || kieData.taskId;

    // Update generation with new task ID and increment scene
    const { error: updateError } = await supabase
      .from('runway_extend_generations')
      .update({ 
        extended_task_id: newTaskId,
        extended_status: 'processing',
        current_scene: scene_number
      })
      .eq('id', generation_id);

    if (updateError) {
      console.error('Failed to update generation:', updateError);
    }

    console.log('Successfully started extension for scene', scene_number);

    return new Response(JSON.stringify({
      success: true,
      task_id: newTaskId,
      scene_number
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in runway-extend-next:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
