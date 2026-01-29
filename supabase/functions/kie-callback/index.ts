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

    const payload = await req.json();
    console.log('📥 Kie.ai callback received:', JSON.stringify(payload, null, 2));

    // Handle both direct and nested formats
    const data = payload.data || payload;
    const taskId = data.taskId || payload.taskId;
    const successFlag = data.info?.successFlag ?? data.successFlag ?? payload.successFlag ?? 1;
    const videoUrls = data.info?.resultUrls || data.info?.result_urls || data.response?.resultUrls || data.resultUrls || [];
    const videoUrl = videoUrls[0];
    const errorMessage = data.info?.errorMessage || data.errorMessage || payload.errorMessage;

    if (!taskId) {
      console.error('❌ No taskId found. Full payload:', JSON.stringify(payload, null, 2));
      throw new Error('No taskId in callback payload');
    }

    // Find the generation record by task ID (could be initial or extended)
    const { data: generations, error: findError } = await supabase
      .from('kie_video_generations')
      .select('*')
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

    // Update the appropriate fields based on which task completed
    const updates: any = {};
    const isSuccess = successFlag === 1;
    const metaBase =
      generation?.metadata && typeof generation.metadata === "object" && !Array.isArray(generation.metadata)
        ? generation.metadata
        : {};
    // Always capture last callback payload for debugging.
    updates.metadata = {
      ...metaBase,
      last_kie_callback: data,
      last_kie_callback_received_at: new Date().toISOString(),
    };
    
    if (isInitial) {
      if (isSuccess && videoUrl) {
        updates.initial_status = 'completed';
        updates.initial_video_url = videoUrl;
        updates.initial_completed_at = new Date().toISOString();
        updates.initial_error = null; // Clear any previous error
        
        // Add to video_segments array
        const currentSegments = generation.video_segments || [];
        // Default duration: 8 seconds for KIE videos (or use generation.duration if available)
        const segmentDuration = (generation.duration || 8) * 1000; // Convert to milliseconds
        updates.video_segments = [
          ...currentSegments,
          {
            url: videoUrl,
            scene: 1,
            type: 'initial',
            duration: segmentDuration,
            completed_at: new Date().toISOString()
          }
        ];
      }
      // If Kie reports success but doesn't include a URL yet, don't mark failed.
      // Some providers will send multiple callbacks or finalize URLs slightly later.
      if (isSuccess && !videoUrl) {
        console.warn('⏳ Initial callback success without URL (keeping generating):', { taskId, generation_id: generation.id });
        // Keep existing status if set; otherwise keep generating.
        updates.initial_status = generation.initial_status === 'completed' ? 'completed' : 'generating';
      } else if (errorMessage || successFlag !== 1) {
        const errorDetail = errorMessage || 'Unknown generation failure';
        // Provide user-friendly message for common policy errors
        let userMessage = errorDetail;
        if (errorDetail.includes('AUDIO_FILTERED') || errorDetail.includes('audio') && errorDetail.includes('filter')) {
          userMessage = 'Audio content was filtered by KIE. Try simplifying the avatar script or removing business-specific terms.';
        } else if (errorDetail.includes('IP_INPUT_IMAGE')) {
          userMessage = 'Input image was rejected by KIE (IP policy). Use a photo you own, or generate without a reference image (text-to-video).';
        }
        updates.initial_error = `Generation failed at Kie.ai: ${userMessage}`;
        console.error('❌ Initial generation failed:', {
          taskId,
          generation_id: generation.id,
          errorMessage: errorDetail,
          successFlag
        });
        updates.initial_status = 'failed';
      }
    } else if (isExtended) {
      if (isSuccess && videoUrl) {
        updates.extended_status = 'completed';
        updates.extended_video_url = videoUrl;
        updates.extended_completed_at = new Date().toISOString();
        updates.extended_error = null; // Clear any previous error
        
        // Add to video_segments array
        const currentSegments = generation.video_segments || [];
        const currentScene = generation.current_scene || (currentSegments.length + 1);
        // Default duration: 8 seconds for KIE videos (or use generation.duration if available)
        const segmentDuration = (generation.duration || 8) * 1000; // Convert to milliseconds
        
        updates.video_segments = [
          ...currentSegments,
          {
            url: videoUrl,
            scene: currentScene,
            type: 'extended',
            duration: segmentDuration,
            completed_at: new Date().toISOString()
          }
        ];
      }
      if (isSuccess && !videoUrl) {
        console.warn('⏳ Extended callback success without URL (keeping generating):', { taskId, generation_id: generation.id });
        updates.extended_status = generation.extended_status === 'completed' ? 'completed' : 'generating';
      } else if (errorMessage || successFlag !== 1) {
        const errorDetail = errorMessage || 'Unknown generation failure';
        // Provide user-friendly message for common policy errors
        let userMessage = errorDetail;
        if (errorDetail.includes('AUDIO_FILTERED') || errorDetail.includes('audio') && errorDetail.includes('filter')) {
          userMessage = 'Audio content was filtered by KIE. Try simplifying the avatar script or removing business-specific terms.';
        } else if (errorDetail.includes('IP_INPUT_IMAGE')) {
          userMessage = 'Input image was rejected by KIE (IP policy). Use a photo you own, or generate without a reference image (text-to-video).';
        }
        updates.extended_error = `Scene ${generation.current_scene}: Generation failed at Kie.ai: ${userMessage}`;
        console.error('❌ Extended generation failed:', {
          taskId,
          generation_id: generation.id,
          scene: generation.current_scene,
          errorMessage: errorDetail,
          successFlag
        });
        updates.extended_status = 'failed';
      }
    }

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
      const currentSegments = (generation.video_segments || []);
      
      if (generation.is_multi_scene) {
        const numberOfScenes = generation.number_of_scenes || 1;
        const currentScene = generation.current_scene || 1;
        const scenePrompts = generation.scene_prompts || [];
        
        console.log(`📊 Multi-scene progress: Scene ${currentScene} of ${numberOfScenes}`);
        console.log(`📦 Current segments: ${currentSegments.length}`);
        
        if (currentScene < numberOfScenes && scenePrompts.length >= numberOfScenes) {
          // More scenes to generate - use same image for avatar consistency
          const nextSceneIndex = currentScene; // 0-indexed for array
          const nextScenePrompt = scenePrompts[nextSceneIndex].prompt;
          
          console.log(`🎬 Triggering scene ${currentScene + 1} with same avatar image...`);
          
          // Update current scene counter
          await supabase
            .from('kie_video_generations')
            .update({ current_scene: currentScene + 1 })
            .eq('id', generation.id);
          
          // Call extend API for smooth video-to-video transitions
          const extendResponse = await supabase.functions.invoke('kie-extend-next', {
            body: {
              generation_id: generation.id,
              scene_prompt: nextScenePrompt // Pass the scene-specific prompt
            }
          });

          if (extendResponse.error) {
            console.error('❌ Failed to trigger next scene:', extendResponse.error);
          } else {
            console.log('✅ Scene extension triggered successfully');
          }
        } else if (currentScene === numberOfScenes && currentSegments.length === numberOfScenes) {
          // All scenes complete - charge credits and auto-trigger combine
          console.log('🎉 All scenes complete! Charging credits and auto-triggering video combine...');
          
          // Charge credits for completed generation
          try {
            // Idempotency: if we already recorded a debit for this generation, skip re-charging
            const { data: existingTx } = await supabase
              .from('credit_transactions')
              .select('id, amount')
              .eq('type', 'debit')
              .eq('metadata->>generation_id', generation.id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (existingTx && existingTx.length > 0) {
              console.log('ℹ️ Credits already charged for generation (skipping):', generation.id);
              // Still mark any pending job as completed for tracking.
              const { data: pendingJob } = await supabase
                .from('video_jobs')
                .select('id')
                .eq('generation_id', generation.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (pendingJob?.id) {
                await supabase
                  .from('video_jobs')
                  .update({
                    status: 'completed',
                    credits_reserved: 0,
                    credits_charged: Math.abs(existingTx[0].amount ?? 0),
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', pendingJob.id);
              }
            } else {

            const fallbackRenderedMinutes = (numberOfScenes * 8) / 60;

            // Prefer charging the reserved/estimated credits from the job record (created on generation start)
            const { data: videoJob, error: jobError } = await supabase
              .from('video_jobs')
              .select('*')
              .eq('generation_id', generation.id)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (jobError && jobError.code !== 'PGRST116') {
              console.warn('⚠️ Could not find video_jobs record:', jobError.message);
            }

            const actualRenderedMinutes = videoJob?.estimated_minutes ?? fallbackRenderedMinutes;
            const actualCredits =
              (videoJob?.credits_reserved ?? videoJob?.estimated_credits ?? numberOfScenes) || 0;

            console.log(`💰 Charging credits for ${numberOfScenes} scenes: ${actualCredits} credits (${actualRenderedMinutes.toFixed(2)} minutes)`);

            if (actualCredits <= 0) {
              console.warn('⚠️ No credits to charge (skipping). generation:', generation.id);
            } else {

            // Get current credit balance
            const { data: balance, error: balanceError } = await supabase
              .from('credit_balance')
              .select('credits')
              .eq('user_id', generation.user_id)
              .single();

            if (balanceError) {
              console.error('❌ Failed to get credit balance:', balanceError);
              throw new Error(`Failed to get credit balance: ${balanceError.message}`);
            }

            const currentBalance = balance?.credits || 0;
            
            if (currentBalance < actualCredits) {
              console.warn(`⚠️ Insufficient credits: ${currentBalance} < ${actualCredits}. Charging available balance.`);
            }

            const newBalance = Math.max(0, currentBalance - actualCredits);

            // Update credit balance
            const { error: updateError } = await supabase
              .from('credit_balance')
              .update({ credits: newBalance })
              .eq('user_id', generation.user_id);

            if (updateError) {
              console.error('❌ Failed to update credit balance:', updateError);
              throw updateError;
            }

            // Create debit transaction
            const { error: txError } = await supabase.from('credit_transactions').insert({
              user_id: generation.user_id,
              type: 'debit',
              amount: -actualCredits,
              balance_after: newBalance,
              metadata: {
                job_id: videoJob?.id || null,
                generation_id: generation.id,
                actual_minutes: actualRenderedMinutes,
                scenes_completed: numberOfScenes,
                video_job_exists: !!videoJob
              }
            });

            if (txError) {
              console.error('❌ Failed to create transaction:', txError);
              // Don't throw - balance already updated
            }

            // Update video_job if it exists
            if (videoJob && !jobError) {
              await supabase
                .from('video_jobs')
                .update({
                  status: 'completed',
                  actual_minutes: actualRenderedMinutes,
                  credits_charged: actualCredits,
                  credits_reserved: 0,
                  completed_at: new Date().toISOString()
                })
                .eq('id', videoJob.id);
            } else {
              // Create video_job record if it doesn't exist (for tracking)
              await supabase.from('video_jobs').insert({
                user_id: generation.user_id,
                generation_id: generation.id,
                provider: 'kie',
                estimated_minutes: actualRenderedMinutes,
                actual_minutes: actualRenderedMinutes,
                estimated_credits: actualCredits,
                credits_charged: actualCredits,
                credits_reserved: 0,
                status: 'completed',
                completed_at: new Date().toISOString(),
                metadata: { created_retroactively: true }
              }).catch(err => {
                console.warn('⚠️ Could not create retroactive video_job:', err);
              });
            }

            console.log(`✅ Charged ${actualCredits} credits (${actualRenderedMinutes.toFixed(2)} minutes) for ${numberOfScenes} scenes. Balance: ${currentBalance} → ${newBalance}`);
            }
            }
          } catch (creditError) {
            console.error('❌ Error charging credits:', creditError);
            // Don't fail the callback if credit charging fails, but log it
          }
          
          // Auto-trigger combine (Cloudinary stitch)
          const stitchResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/cloudinary-stitch-videos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              generation_id: generation.id,
              trim: false
            })
          });

          if (!stitchResponse.ok) {
            console.error('❌ Failed to trigger combine:', await stitchResponse.text());
          }
        }
      } else {
        // Single scene - charge credits when initial scene completes
        if (isInitial && videoUrl && successFlag === 1) {
          try {
            // Idempotency: if we already recorded a debit for this generation, skip re-charging
            const { data: existingTx } = await supabase
              .from('credit_transactions')
              .select('id, amount')
              .eq('type', 'debit')
              .eq('metadata->>generation_id', generation.id)
              .order('created_at', { ascending: false })
              .limit(1);

            if (existingTx && existingTx.length > 0) {
              console.log('ℹ️ Credits already charged for generation (skipping):', generation.id);
            } else {
              const fallbackRenderedMinutes = 8 / 60; // single 8s clip

              // Prefer charging the reserved/estimated credits from the job record (created on generation start)
              const { data: videoJob, error: jobError } = await supabase
                .from('video_jobs')
                .select('*')
                .eq('generation_id', generation.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (jobError && jobError.code !== 'PGRST116') {
                console.warn('⚠️ Could not find video_jobs record:', jobError.message);
              }

              const actualRenderedMinutes = videoJob?.estimated_minutes ?? fallbackRenderedMinutes;
              const actualCredits =
                (videoJob?.credits_reserved ?? videoJob?.estimated_credits ?? 1) || 0;

              console.log(`💰 Charging credits for single scene: ${actualCredits} credits (${actualRenderedMinutes.toFixed(2)} minutes)`);

              if (actualCredits <= 0) {
                console.warn('⚠️ No credits to charge (skipping). generation:', generation.id);
              } else {

            // Get current credit balance
            const { data: balance, error: balanceError } = await supabase
              .from('credit_balance')
              .select('credits')
              .eq('user_id', generation.user_id)
              .single();

            if (balanceError) {
              console.error('❌ Failed to get credit balance:', balanceError);
              throw new Error(`Failed to get credit balance: ${balanceError.message}`);
            }

            const currentBalance = balance?.credits || 0;
            
            if (currentBalance < actualCredits) {
              console.warn(`⚠️ Insufficient credits: ${currentBalance} < ${actualCredits}. Charging available balance.`);
            }

            const newBalance = Math.max(0, currentBalance - actualCredits);

            // Update credit balance
            const { error: updateError } = await supabase
              .from('credit_balance')
              .update({ credits: newBalance })
              .eq('user_id', generation.user_id);

            if (updateError) {
              console.error('❌ Failed to update credit balance:', updateError);
              throw updateError;
            }

            // Create debit transaction
            const { error: txError } = await supabase.from('credit_transactions').insert({
              user_id: generation.user_id,
              type: 'debit',
              amount: -actualCredits,
              balance_after: newBalance,
              metadata: {
                job_id: videoJob?.id || null,
                generation_id: generation.id,
                actual_minutes: actualRenderedMinutes,
                scenes_completed: 1,
                video_job_exists: !!videoJob
              }
            });

            if (txError) {
              console.error('❌ Failed to create transaction:', txError);
              // Don't throw - balance already updated
            }

            // Update video_job if it exists
            if (videoJob && !jobError) {
              await supabase
                .from('video_jobs')
                .update({
                  status: 'completed',
                  actual_minutes: actualRenderedMinutes,
                  credits_charged: actualCredits,
                  credits_reserved: 0,
                  completed_at: new Date().toISOString()
                })
                .eq('id', videoJob.id);
            } else {
              // Create video_job record if it doesn't exist (for tracking)
              await supabase.from('video_jobs').insert({
                user_id: generation.user_id,
                generation_id: generation.id,
                provider: 'kie',
                estimated_minutes: actualRenderedMinutes,
                actual_minutes: actualRenderedMinutes,
                estimated_credits: actualCredits,
                credits_charged: actualCredits,
                credits_reserved: 0,
                status: 'completed',
                completed_at: new Date().toISOString(),
                metadata: { created_retroactively: true }
              }).catch(err => {
                console.warn('⚠️ Could not create retroactive video_job:', err);
              });
            }

            console.log(`✅ Charged ${actualCredits} credits for single scene completion. Balance: ${currentBalance} → ${newBalance}`);
              }
            }
          } catch (creditError) {
            console.error('❌ Error charging credits:', creditError);
            // Don't fail the callback if credit charging fails, but log it
          }
        }
        
        // Auto-trigger first extend only
        if (isInitial && (currentSegments.length === 0 || (currentSegments.length === 1 && currentSegments[0].type === 'initial'))) {
          console.log('✅ Initial video completed, auto-triggering FIRST extend...');
          
          const extendResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/kie-extend-video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              generation_id: generation.id,
              initial_task_id: taskId
            })
          });

          if (!extendResponse.ok) {
            console.error('❌ Failed to trigger extend:', await extendResponse.text());
          }
        }
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
    console.error('❌ Error in kie-callback:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Callback processing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
