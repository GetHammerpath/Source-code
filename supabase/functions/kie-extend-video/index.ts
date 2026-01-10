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
    const { generation_id, initial_task_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const KIE_AI_TOKEN = Deno.env.get('KIE_AI_API_TOKEN');
    if (!KIE_AI_TOKEN) {
      throw new Error('KIE_AI_API_TOKEN not configured');
    }

    // Get generation record
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      throw new Error('Generation not found');
    }

    console.log('🎬 Extending video for generation:', generation_id);

    // Generate extension prompt using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const extendPromptResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at writing video extension prompts that continue the story from the initial video.'
          },
          {
            role: 'user',
            content: `The initial video showed: "${generation.ai_prompt}"

Now write a continuation prompt that extends the story for another 8 seconds. The extension should:
- Continue the narrative naturally
- Show additional aspects of the business/work
- Maintain the same cinematic quality
- Feature the same character/location
- Build on the initial scene

Return ONLY the extension prompt, no other text.`
          }
        ]
      })
    });

    const extendPromptData = await extendPromptResponse.json();
    const extensionPrompt = extendPromptData.choices?.[0]?.message?.content || 'Continue the story, showing more of the work and the character interacting with the environment.';

    console.log('📝 Extension prompt:', extensionPrompt);

    // Prepare callback URL
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/kie-callback`;

    // Call Kie.ai extend endpoint
    const kieResponse = await fetch('https://api.kie.ai/api/v1/veo/extend', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KIE_AI_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: initial_task_id,
        prompt: extensionPrompt,
        seeds: generation.seeds || undefined,
        watermark: generation.watermark || '',
        callBackUrl: callbackUrl
      })
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error('❌ Kie.ai extend API error:', kieResponse.status, errorText);
      
      await supabase
        .from('kie_video_generations')
        .update({
          extended_status: 'failed',
          extended_error: `API error: ${kieResponse.status} - ${errorText}`
        })
        .eq('id', generation_id);

      throw new Error(`Kie.ai extend API error: ${kieResponse.status}`);
    }

    const kieData = await kieResponse.json();
    console.log('📦 Raw Kie.ai extend response:', JSON.stringify(kieData, null, 2));

    // Handle nested response structure - check multiple possible locations
    const data = kieData.data || kieData;
    const extendTaskId = data.taskId || data.task_id || kieData.taskId || kieData.task_id;

    if (!extendTaskId) {
      console.error('❌ No task ID found in response:', JSON.stringify(kieData, null, 2));
      throw new Error('No task ID returned from Kie.ai extend');
    }

    console.log('✅ Kie.ai extend task created:', extendTaskId);

    // Update database with extend task ID
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update({
        extended_task_id: extendTaskId,
        extended_status: 'generating'
      })
      .eq('id', generation_id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({
      success: true,
      extend_task_id: extendTaskId,
      message: 'Video extension started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in kie-extend-video:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extend video'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
