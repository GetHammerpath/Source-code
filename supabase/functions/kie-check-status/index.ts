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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { generation_id } = await req.json();

    if (!generation_id) {
      throw new Error('generation_id is required');
    }

    // Get the generation record
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      console.error('❌ Generation not found:', generation_id);
      throw new Error('Generation record not found');
    }

    const kieToken = Deno.env.get('KIE_AI_API_TOKEN');
    if (!kieToken) {
      throw new Error('KIE_AI_API_TOKEN not configured');
    }

    const updates: any = {};
    let needsUpdate = false;

    // Check initial video status if generating
    if (generation.initial_task_id && generation.initial_status === 'generating') {
      console.log('🔍 Checking initial video status:', generation.initial_task_id);
      
      const statusResponse = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${generation.initial_task_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${kieToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('📦 Raw initial status response:', JSON.stringify(statusData, null, 2));
        
        const data = statusData.data || statusData;
        const info = data.info || data;
        
        // Check multiple possible locations for video URL
        const videoUrl = info.resultUrls?.[0] || data.response?.resultUrls?.[0] || data.resultUrls?.[0];
        const successFlag = info.successFlag ?? data.successFlag ?? statusData.successFlag;
        const errorMessage = info.errorMessage || data.errorMessage || statusData.errorMessage;
        
        if (successFlag === 1 && videoUrl) {
          updates.initial_status = 'completed';
          updates.initial_video_url = videoUrl;
          updates.initial_completed_at = new Date().toISOString();
          needsUpdate = true;
          console.log('✅ Initial video completed:', updates.initial_video_url);
        } else if (successFlag === 0 || errorMessage) {
          updates.initial_status = 'failed';
          updates.initial_error = errorMessage || 'Video generation failed';
          needsUpdate = true;
          console.log('❌ Initial video failed:', updates.initial_error);
        }
      }
    }

    // Check extended video status if generating
    if (generation.extended_task_id && generation.extended_status === 'generating') {
      console.log('🔍 Checking extended video status:', generation.extended_task_id);
      
      const statusResponse = await fetch(`https://api.kie.ai/api/v1/veo/record-info?taskId=${generation.extended_task_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${kieToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('📦 Raw extended status response:', JSON.stringify(statusData, null, 2));
        
        const data = statusData.data || statusData;
        const info = data.info || data;
        
        // Check multiple possible locations for video URL
        const videoUrl = info.resultUrls?.[0] || data.response?.resultUrls?.[0] || data.resultUrls?.[0];
        const successFlag = info.successFlag ?? data.successFlag ?? statusData.successFlag;
        const errorMessage = info.errorMessage || data.errorMessage || statusData.errorMessage;
        
        if (successFlag === 1 && videoUrl) {
          updates.extended_status = 'completed';
          updates.extended_video_url = videoUrl;
          updates.extended_completed_at = new Date().toISOString();
          needsUpdate = true;
          console.log('✅ Extended video completed:', updates.extended_video_url);
        } else if (successFlag === 0 || errorMessage) {
          updates.extended_status = 'failed';
          updates.extended_error = errorMessage || 'Video generation failed';
          needsUpdate = true;
          console.log('❌ Extended video failed:', updates.extended_error);
        }
      }
    }

    // Update database if needed
    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('kie_video_generations')
        .update(updates)
        .eq('id', generation_id);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw updateError;
      }

      // If initial just completed, trigger extend
      if (updates.initial_status === 'completed' && !generation.extended_task_id) {
        console.log('🚀 Triggering extend for completed initial video');
        
        const { error: extendError } = await supabase.functions.invoke('kie-extend-video', {
          body: {
            generation_id: generation.id,
            initial_task_id: generation.initial_task_id
          }
        });

        if (extendError) {
          console.error('❌ Failed to trigger extend:', extendError);
        } else {
          console.log('✅ Successfully triggered extend');
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      updated: needsUpdate,
      status: {
        initial: updates.initial_status || generation.initial_status,
        extended: updates.extended_status || generation.extended_status
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error checking status:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
