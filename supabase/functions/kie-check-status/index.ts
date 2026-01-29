import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function maybeChargeCreditsForGeneration(
  supabase: any,
  generation: any,
  generationId: string
) {
  // Don't charge here for multi-scene jobs (handled in `kie-callback`).
  // This function exists primarily to cover cases where the Kie callback
  // never arrives and the UI relies on polling via `kie-check-status`.
  const isMultiScene = !!generation?.is_multi_scene || (generation?.number_of_scenes ?? 1) > 1;
  if (isMultiScene) {
    console.log('ℹ️ Skipping credit charge in kie-check-status for multi-scene generation:', generationId);
    return;
  }

  // Idempotency: skip if we already recorded a debit for this generation
  const { data: existingTx, error: txCheckError } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('type', 'debit')
    .eq('metadata->>generation_id', generationId)
    .limit(1);

  if (txCheckError) {
    console.warn('⚠️ Failed to check existing credit transaction:', txCheckError);
  }
  if (existingTx && existingTx.length > 0) {
    console.log('ℹ️ Credits already charged for generation (skipping):', generationId);
    return;
  }

  // Prefer charging the reserved/estimated credits from the job record
  const { data: pendingJob, error: jobErr } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('generation_id', generationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobErr && jobErr.code !== 'PGRST116') {
    console.warn('⚠️ Could not fetch pending video_job:', jobErr);
  }

  const renderedMinutes = 8 / 60; // single 8s clip
  const creditsToCharge = (pendingJob?.credits_reserved ?? pendingJob?.estimated_credits ?? 1) || 0;

  if (creditsToCharge <= 0) {
    console.warn('⚠️ No credits to charge for generation:', generationId);
    return;
  }

  const userId = generation.user_id;

  // Get current balance
  const { data: balance, error: balanceError } = await supabase
    .from('credit_balance')
    .select('credits')
    .eq('user_id', userId)
    .single();

  if (balanceError) {
    console.error('❌ Failed to get credit balance:', balanceError);
    return;
  }

  const currentBalance = balance?.credits || 0;
  const newBalance = Math.max(0, currentBalance - creditsToCharge);

  // Update balance
  const { error: updateError } = await supabase
    .from('credit_balance')
    .update({ credits: newBalance })
    .eq('user_id', userId);

  if (updateError) {
    console.error('❌ Failed to update credit balance:', updateError);
    return;
  }

  // Record transaction
  const { error: txError } = await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'debit',
    amount: -creditsToCharge,
    balance_after: newBalance,
    metadata: {
      job_id: pendingJob?.id ?? null,
      generation_id: generationId,
      actual_minutes: pendingJob?.estimated_minutes ?? renderedMinutes,
      charged_by: 'kie-check-status',
    },
  });

  if (txError) {
    console.error('❌ Failed to insert credit transaction:', txError);
    // Balance already updated; do not throw.
  }

  // Mark job completed (or create a retroactive one for tracking)
  if (pendingJob?.id) {
    await supabase
      .from('video_jobs')
      .update({
        status: 'completed',
        actual_minutes: pendingJob?.estimated_minutes ?? renderedMinutes,
        credits_charged: creditsToCharge,
        credits_reserved: 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', pendingJob.id);
  } else {
    await supabase
      .from('video_jobs')
      .insert({
        user_id: userId,
        generation_id: generationId,
        provider: 'kie',
        estimated_minutes: renderedMinutes,
        actual_minutes: renderedMinutes,
        estimated_credits: creditsToCharge,
        credits_reserved: 0,
        credits_charged: creditsToCharge,
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: { created_retroactively: true, source: 'kie-check-status' },
      })
      .catch((e: any) => console.warn('⚠️ Failed to create retroactive video_job:', e));
  }

  console.log(`✅ Charged ${creditsToCharge} credits via kie-check-status. Balance: ${currentBalance} → ${newBalance}`);
}

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
        const normalizedError =
          typeof errorMessage === "string" && /IP_INPUT_IMAGE/i.test(errorMessage)
            ? `Input image rejected by Kie policy (${errorMessage}). Use a photo you own, or generate without a reference image (text-to-video).`
            : errorMessage;
        const completeTime = info.completeTime ?? data.completeTime ?? statusData.completeTime;
        const stateRaw = info.state ?? data.state ?? info.status ?? data.status ?? null;
        const state = typeof stateRaw === "string" ? stateRaw.toLowerCase() : null;
        
        if (successFlag === 1 && videoUrl) {
          updates.initial_status = 'completed';
          updates.initial_video_url = videoUrl;
          updates.initial_completed_at = new Date().toISOString();
          needsUpdate = true;
          console.log('✅ Initial video completed:', updates.initial_video_url);
        } else if (normalizedError || state === "failed" || state === "error" || (completeTime && successFlag === 0)) {
          const fallbackDetail = (() => {
            try {
              const raw = JSON.stringify(statusData);
              return raw.length > 4000 ? `${raw.slice(0, 4000)}…(truncated)` : raw;
            } catch {
              return null;
            }
          })();
          updates.initial_status = 'failed';
          updates.initial_error =
            normalizedError ||
            (fallbackDetail ? `Video generation failed. Details: ${fallbackDetail}` : 'Video generation failed');
          needsUpdate = true;
          console.log('❌ Initial video failed:', updates.initial_error);
        } else {
          // Likely still processing (some Kie responses report successFlag=0 with no error while running)
          console.log('⏳ Initial video still processing:', {
            taskId: generation.initial_task_id,
            successFlag,
            state: stateRaw ?? null,
            hasVideoUrl: !!videoUrl,
          });
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
        const normalizedError =
          typeof errorMessage === "string" && /IP_INPUT_IMAGE/i.test(errorMessage)
            ? `Input image rejected by Kie policy (${errorMessage}). Use a photo you own, or generate without a reference image (text-to-video).`
            : errorMessage;
        const completeTime = info.completeTime ?? data.completeTime ?? statusData.completeTime;
        const stateRaw = info.state ?? data.state ?? info.status ?? data.status ?? null;
        const state = typeof stateRaw === "string" ? stateRaw.toLowerCase() : null;
        
        if (successFlag === 1 && videoUrl) {
          updates.extended_status = 'completed';
          updates.extended_video_url = videoUrl;
          updates.extended_completed_at = new Date().toISOString();
          needsUpdate = true;
          console.log('✅ Extended video completed:', updates.extended_video_url);
        } else if (normalizedError || state === "failed" || state === "error" || (completeTime && successFlag === 0)) {
          const fallbackDetail = (() => {
            try {
              const raw = JSON.stringify(statusData);
              return raw.length > 4000 ? `${raw.slice(0, 4000)}…(truncated)` : raw;
            } catch {
              return null;
            }
          })();
          updates.extended_status = 'failed';
          updates.extended_error =
            normalizedError ||
            (fallbackDetail ? `Video generation failed. Details: ${fallbackDetail}` : 'Video generation failed');
          needsUpdate = true;
          console.log('❌ Extended video failed:', updates.extended_error);
        } else {
          console.log('⏳ Extended video still processing:', {
            taskId: generation.extended_task_id,
            successFlag,
            state: stateRaw ?? null,
            hasVideoUrl: !!videoUrl,
          });
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

      // If a non-multi-scene video just completed, charge credits here (covers polling path).
      const initialJustCompleted = generation.initial_status !== 'completed' && updates.initial_status === 'completed';
      const extendedJustCompleted = generation.extended_status !== 'completed' && updates.extended_status === 'completed';
      if (initialJustCompleted || extendedJustCompleted) {
        try {
          await maybeChargeCreditsForGeneration(supabase, generation, generation_id);
        } catch (e) {
          console.error('❌ Error charging credits in kie-check-status:', e);
          // Don't fail status check due to billing issues.
        }
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
