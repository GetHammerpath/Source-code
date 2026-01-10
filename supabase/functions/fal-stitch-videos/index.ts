import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

  let generation_id: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    generation_id = body.generation_id;
    const trim = body.trim ?? false;

    console.log('🎬 Stitch request for generation:', generation_id);

    // Get generation record
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      throw new Error('Generation not found');
    }

    // Validate segments
    const segments = generation.video_segments || [];
    if (segments.length < 2) {
      throw new Error('Need at least 2 video segments to stitch');
    }

    // Validate all segments have URLs
    const invalidSegment = segments.find((seg: any) => !seg.url);
    if (invalidSegment) {
      throw new Error('All segments must have valid URLs');
    }

    const FAL_API_KEY = Deno.env.get('FAL_API_KEY');
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY not configured');
    }

    let falResponse;
    
    if (trim) {
      // Use compose API for trimmed merge
      console.log(`🎥 Merging ${segments.length} video segments with trim (smooth transitions)...`);
      
      const inputs = segments.map((seg: any, index: number) => {
        const input: any = {
          file_url: seg.url
        };
        
        // Trim first 1.5 seconds from scenes 2, 3, 4+
        if (index > 0) {
          input.options = [
            {
              option: "-ss",
              argument: 1.5
            }
          ];
        }
        
        return input;
      });
      
      console.log('📋 Inputs with trim:', JSON.stringify(inputs, null, 2));
      console.log('📤 Calling Fal.ai compose API (trimmed merge)...');
      
      falResponse = await fetch('https://queue.fal.run/fal-ai/ffmpeg-api/compose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${FAL_API_KEY}`
        },
        body: JSON.stringify({
          inputs: inputs
        })
      });
    } else {
      // Use simple merge-videos API for fast concatenation
      console.log(`🎥 Concatenating ${segments.length} video segments (simple merge, fast processing)...`);
      
      const videoUrls = segments.map((seg: any) => seg.url);
      
      console.log('📋 Video URLs to merge:', JSON.stringify(videoUrls, null, 2));
      console.log('📤 Calling Fal.ai merge-videos API (fast concatenation)...');
      
      falResponse = await fetch('https://queue.fal.run/fal-ai/ffmpeg-api/merge-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Key ${FAL_API_KEY}`
        },
        body: JSON.stringify({
          video_urls: videoUrls
        })
      });
    }

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error('❌ Fal.ai error:', errorText);
      throw new Error(`Fal.ai API error: ${falResponse.status} - ${errorText}`);
    }

    const falData = await falResponse.json();
    console.log('📦 Fal.ai response:', JSON.stringify(falData, null, 2));

    // Fal.ai uses a queue system, we get a request_id, status_url, and response_url
    const requestId = falData.request_id;
    const statusUrl = falData.status_url;
    const responseUrl = falData.response_url;
    
    if (!requestId || !statusUrl || !responseUrl) {
      throw new Error('Missing required fields from Fal.ai response');
    }

    console.log('🎫 Got request ID:', requestId);
    console.log('📍 Status URL:', statusUrl);
    console.log('📍 Response URL:', responseUrl);

    // Update database with task ID, status, and URLs
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update({
        final_video_task_id: requestId,
        final_video_status_url: statusUrl,
        final_video_response_url: responseUrl,
        final_video_status: 'generating',
        is_final: true
      })
      .eq('id', generation_id);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Stitching job started. Will be completed asynchronously.');

    return new Response(JSON.stringify({
      success: true,
      message: 'Video stitching started',
      request_id: requestId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in fal-stitch-videos:', error);
    
    // Update database with error using generation_id from outer scope
    if (generation_id) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        await supabase
          .from('kie_video_generations')
          .update({
            final_video_status: 'failed',
            final_video_error: error instanceof Error ? error.message : 'Stitching failed'
          })
          .eq('id', generation_id);
      } catch (dbError) {
        console.error('Failed to update error in database:', dbError);
      }
    }

    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Stitching failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
