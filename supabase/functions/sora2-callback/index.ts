import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phase 4: Fallback model chain (primary -> fallback)
const FALLBACK_MODELS: Record<string, string> = {
  sora2_pro_720: "veo3_fast",
  sora2_pro_1080: "sora2_pro_720",
};

// Phase 4: Error types that should trigger fallback
const FALLBACK_ERROR_PATTERNS = [
  'CONTENT_POLICY',
  'rate limit',
  'too many requests',
  'provider error',
  'model unavailable',
];

// Phase 4: Check if error should trigger fallback
function shouldTriggerFallback(errorMessage: string): { should: boolean; reason: string } {
  const lowerError = errorMessage.toLowerCase();
  for (const pattern of FALLBACK_ERROR_PATTERNS) {
    if (lowerError.includes(pattern.toLowerCase())) {
      return { should: true, reason: pattern.replace(/ /g, '_').toLowerCase() };
    }
  }
  return { should: false, reason: '' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceKey
    );

    const payload = await req.json();
    console.log('📥 Sora2 callback received:', JSON.stringify(payload, null, 2));

    // Handle both direct and nested formats
    const data = payload.data || payload;
    const taskId = data.taskId || payload.taskId;
    
    // Fix: Check state === 'success' for Kie.ai response format
    const isSuccess = data.state === 'success';
    const successFlag = isSuccess ? 1 : (data.info?.successFlag ?? data.successFlag ?? payload.successFlag ?? 0);
    
    // Fix: Parse resultJson string to extract video URLs
    let videoUrls: string[] = [];
    if (data.resultJson) {
      try {
        const resultData = typeof data.resultJson === 'string' 
          ? JSON.parse(data.resultJson) 
          : data.resultJson;
        videoUrls = resultData.resultUrls || resultData.result_urls || [];
        console.log('📦 Parsed resultJson, found URLs:', videoUrls);
      } catch (e) {
        console.log('⚠️ Failed to parse resultJson:', e);
      }
    }
    
    // Fallback to other paths if resultJson parsing didn't work
    if (!videoUrls.length) {
      videoUrls = data.info?.resultUrls || data.info?.result_urls || 
                  data.response?.resultUrls || data.resultUrls || [];
    }
    
    const videoUrl = videoUrls[0];
    const errorMessage = data.info?.errorMessage || data.errorMessage || payload.errorMessage;
    
    console.log(`📊 Parsed callback - Success: ${isSuccess}, Video URL: ${videoUrl ? 'found' : 'missing'}`);

    if (!taskId) {
      console.error('❌ No taskId found. Full payload:', JSON.stringify(payload, null, 2));
      throw new Error('No taskId in callback payload');
    }

    // Find the generation record by task ID (could be initial or extended)
    const { data: generations, error: findError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('sora_model', 'sora-2-pro-image-to-video')
      .or(`initial_task_id.eq.${taskId},extended_task_id.eq.${taskId}`)
      .limit(1);

    if (findError || !generations || generations.length === 0) {
      console.error('❌ Generation not found for taskId:', taskId);
      throw new Error('Generation record not found');
    }

    const generation = generations[0];
    const isInitial = generation.initial_task_id === taskId;
    const isExtended = generation.extended_task_id === taskId;

    console.log(`📹 Updating ${isInitial ? 'initial' : 'extended'} generation:`, generation.id);
    console.log(`📊 Current scene: ${generation.current_scene} of ${generation.number_of_scenes}`);

    // Update the appropriate fields based on which task completed
    const updates: any = {};
    const status = successFlag === 1 && videoUrl ? 'completed' : 'failed';
    const currentSegments = generation.video_segments || [];
    const currentScene = generation.current_scene || 1;
    
    if (isInitial) {
      updates.initial_status = status;
      if (videoUrl) {
        updates.initial_video_url = videoUrl;
        updates.initial_completed_at = new Date().toISOString();
        updates.initial_error = null;
        
        // Add to video_segments array
        updates.video_segments = [
          ...currentSegments,
          {
            url: videoUrl,
            scene: 1,
            type: 'initial',
            duration: (generation.duration || 10) * 1000,
            completed_at: new Date().toISOString()
          }
        ];
      }
      if (errorMessage || successFlag !== 1) {
        const errorDetail = errorMessage || 'Unknown error';
        
        // Phase 4: Check if we should trigger fallback
        const currentModel = generation.model || 'sora2_pro_720';
        const retryCount = generation.retry_count || 0;
        const { should: shouldFallbackCheck, reason: fallbackReason } = shouldTriggerFallback(errorDetail);
        const fallbackModel = FALLBACK_MODELS[currentModel];
        
        if (shouldFallbackCheck && fallbackModel && retryCount < 2) {
          console.log(`🔄 Phase 4: Triggering Sora2 fallback from ${currentModel} to ${fallbackModel}`);
          updates.fallback_model = fallbackModel;
          updates.fallback_reason = fallbackReason;
          updates.retry_count = retryCount + 1;
          updates.original_model = generation.original_model || currentModel;
          updates.initial_status = 'retrying';
          updates.initial_error = `Retrying with ${fallbackModel} (${fallbackReason})`;
          
          // Trigger fallback after update
          fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/video-generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              generation_id: generation.id,
              model: fallbackModel,
              prompt: generation.ai_prompt || generation.scene_prompts?.[0]?.prompt || '',
              image_url: generation.image_url,
              aspect_ratio: generation.aspect_ratio || '16:9',
              is_fallback_retry: true,
            }),
          }).catch(err => console.error('❌ Fallback retry error:', err));
        } else {
          updates.initial_error = `Scene 1 failed: ${errorDetail}`;
        }
      }
    } else if (isExtended) {
      updates.extended_status = status;
      if (videoUrl) {
        updates.extended_video_url = videoUrl;
        updates.extended_completed_at = new Date().toISOString();
        updates.extended_error = null;
        
        // Add to video_segments array
        updates.video_segments = [
          ...currentSegments,
          {
            url: videoUrl,
            scene: currentScene,
            type: 'extended',
            duration: (generation.duration || 10) * 1000,
            completed_at: new Date().toISOString()
          }
        ];
      }
      if (errorMessage || successFlag !== 1) {
        updates.extended_error = `Scene ${currentScene} failed: ${errorMessage || 'Unknown error'}`;
      }
    }

    // Apply updates
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update(updates)
      .eq('id', generation.id);

    if (updateError) {
      console.error('❌ Database update error:', updateError);
      throw updateError;
    }

    // Handle multi-scene orchestration
    if (successFlag === 1 && videoUrl) {
      const newSegmentsCount = (updates.video_segments || currentSegments).length;
      const numberOfScenes = generation.number_of_scenes || 1;
      const scenePrompts = generation.scene_prompts || [];
      const isMultiScene = generation.is_multi_scene || numberOfScenes > 1;

      console.log(`📊 Multi-scene orchestration check:
  - Completed segments: ${newSegmentsCount}
  - Total scenes needed: ${numberOfScenes}
  - Scene prompts available: ${scenePrompts.length}
  - Is multi-scene: ${isMultiScene}
  - Current scene was: ${currentScene}`);

      if (isMultiScene && newSegmentsCount < numberOfScenes) {
        // More scenes to generate
        const nextSceneIndex = newSegmentsCount; // 0-indexed for array
        const nextScenePrompt = scenePrompts[nextSceneIndex];
        const nextSceneNumber = newSegmentsCount + 1;

        console.log(`🎬 Preparing to trigger scene ${nextSceneNumber} of ${numberOfScenes}`);
        console.log(`📝 Next scene prompt preview: ${nextScenePrompt?.prompt?.substring(0, 100) || 'NO PROMPT FOUND'}...`);

        if (!nextScenePrompt || !nextScenePrompt.prompt) {
          console.error(`❌ No scene prompt found for scene ${nextSceneNumber} at index ${nextSceneIndex}`);
          console.error(`Available scene prompts:`, JSON.stringify(scenePrompts, null, 2));
        } else {
          // Update current scene counter BEFORE triggering next scene
          const { error: sceneUpdateError } = await supabase
            .from('kie_video_generations')
            .update({ 
              current_scene: nextSceneNumber,
              extended_status: 'pending'
            })
            .eq('id', generation.id);

          if (sceneUpdateError) {
            console.error('❌ Failed to update current_scene:', sceneUpdateError);
          } else {
            console.log(`✅ Updated current_scene to ${nextSceneNumber}`);
          }

          // Call extend function for next scene
          console.log(`🚀 Calling sora2-extend-next for scene ${nextSceneNumber}...`);
          
          const extendResponse = await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/sora2-extend-next`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`
            },
            body: JSON.stringify({
              generation_id: generation.id,
              scene_prompt: nextScenePrompt.prompt,
              scene_script: nextScenePrompt.script || ''
            })
          });

          const extendResponseText = await extendResponse.text();
          
          if (!extendResponse.ok) {
            console.error(`❌ Failed to trigger scene ${nextSceneNumber}:`, extendResponseText);
            
            // Update with error status
            await supabase
              .from('kie_video_generations')
              .update({ 
                extended_status: 'failed',
                extended_error: `Failed to start scene ${nextSceneNumber}: ${extendResponseText}`
              })
              .eq('id', generation.id);
          } else {
            console.log(`✅ Scene ${nextSceneNumber} triggered successfully:`, extendResponseText);
          }
        }
      } else if (newSegmentsCount >= numberOfScenes) {
        // All scenes complete - charge credits and trigger stitching
        console.log(`🎉 All ${numberOfScenes} scenes complete! Charging credits and triggering video combine...`);
        console.log(`📹 Video segments:`, JSON.stringify(updates.video_segments, null, 2));

        // Charge credits (idempotent - skip if already charged)
        try {
          const { data: existingTx } = await supabase
            .from('credit_transactions')
            .select('id, amount')
            .eq('type', 'debit')
            .eq('metadata->>generation_id', generation.id)
            .order('created_at', { ascending: false })
            .limit(1);

          if (!existingTx?.length) {
            const { data: videoJob } = await supabase
              .from('video_jobs')
              .select('*')
              .eq('generation_id', generation.id)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const creditsPerSegment: Record<string, number> = {
              sora2_pro_720: 1,
              sora2_pro_1080: 2,
            };
            const modelId = (generation.model as string) || 'sora2_pro_720';
            const rate = creditsPerSegment[modelId] ?? 1;
            const actualCredits = videoJob?.credits_reserved ?? videoJob?.estimated_credits ?? Math.ceil(numberOfScenes * rate);
            const actualRenderedMinutes = videoJob?.estimated_minutes ?? (numberOfScenes * (generation.duration || 10)) / 60;

            if (actualCredits > 0) {
              const { data: balance } = await supabase
                .from('credit_balance')
                .select('credits')
                .eq('user_id', generation.user_id)
                .single();
              const currentBalance = balance?.credits ?? 0;
              const newBalance = Math.max(0, currentBalance - actualCredits);

              await supabase.from('credit_balance').update({ credits: newBalance }).eq('user_id', generation.user_id);
              await supabase.from('credit_transactions').insert({
                user_id: generation.user_id,
                type: 'debit',
                amount: -actualCredits,
                balance_after: newBalance,
                metadata: {
                  job_id: videoJob?.id,
                  generation_id: generation.id,
                  actual_minutes: actualRenderedMinutes,
                  scenes_completed: numberOfScenes,
                },
              });
              if (videoJob?.id) {
                await supabase.from('video_jobs').update({
                  status: 'completed',
                  credits_charged: actualCredits,
                  credits_reserved: 0,
                  completed_at: new Date().toISOString(),
                }).eq('id', videoJob.id);
              }
              console.log(`✅ Charged ${actualCredits} credits for Sora2 generation`);
            }
          }
        } catch (creditErr) {
          console.error('❌ Error charging Sora2 credits:', creditErr);
        }

        const stitchResponse = await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/cloudinary-stitch-videos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`
          },
          body: JSON.stringify({
            generation_id: generation.id,
            trim: true,
            trim_seconds: 1
          })
        });

        if (!stitchResponse.ok) {
          const stitchError = await stitchResponse.text();
          console.error('❌ Failed to trigger combine:', stitchError);
        } else {
          console.log('✅ Video combine triggered successfully');
        }
      } else {
        console.log(`ℹ️ Single scene video or scene prompts mismatch - no further orchestration needed`);
      }
    }

    console.log('✅ Callback processed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Callback processed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in sora2-callback:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Callback processing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
