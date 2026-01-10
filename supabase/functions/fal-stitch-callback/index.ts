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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { generation_id } = await req.json();

    console.log('🔍 Fetching video for generation:', generation_id);

    // Get generation record
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      throw new Error('Generation not found');
    }

    const responseUrl = generation.final_video_response_url;
    
    if (!responseUrl) {
      throw new Error('Missing response_url from generation record');
    }

    // If already completed, return cached result
    if (generation.final_video_status === 'completed' && generation.final_video_url) {
      return new Response(JSON.stringify({
        success: true,
        status: 'completed',
        video_url: generation.final_video_url
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('📡 Fetching video from response URL:', responseUrl);

    const FAL_API_KEY = Deno.env.get('FAL_API_KEY');
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY not configured');
    }

    // Directly fetch from response URL
    const responseData = await fetch(responseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!responseData.ok) {
      // If 404 or 425, video might still be processing
      if (responseData.status === 404 || responseData.status === 425) {
        return new Response(JSON.stringify({
          success: true,
          status: 'generating',
          message: 'Video still processing'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      }
      
      // For 422 errors, check if it's an old format issue
      if (responseData.status === 422) {
        try {
          const errorJson = await responseData.json();
          
          // Check if this is the "missing keyframes" validation error
          if (errorJson.detail && Array.isArray(errorJson.detail)) {
            const hasKeyframesError = errorJson.detail.some(
              (err: any) => err.loc && err.loc.includes('keyframes')
            );
            
            if (hasKeyframesError) {
              console.error('❌ Old request format detected (missing keyframes)');
              
              // Mark as failed in database with helpful message
              await supabase
                .from('kie_video_generations')
                .update({
                  final_video_status: 'failed',
                  final_video_error: 'Request format incompatible - please retry video combination'
                })
                .eq('id', generation_id);
              
              // Return failed status (not throw error)
              return new Response(JSON.stringify({
                success: false,
                status: 'failed',
                error: 'Request format incompatible - please retry video combination'
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
              });
            }
          }
        } catch (parseError) {
          console.error('Failed to parse 422 error as JSON:', parseError);
        }
      }
      
      // Generic error for other cases
      const errorBody = await responseData.text();
      console.error('❌ Fal.ai response error:', responseData.status, errorBody);
      throw new Error(`Failed to fetch response: ${responseData.status} - ${errorBody}`);
    }

    const responseJson = await responseData.json();
    console.log('📦 Fal.ai response data:', JSON.stringify(responseJson, null, 2));

    // Try flat format first (actual Fal.ai response), then nested format for compatibility
    const videoUrl = responseJson.video_url || responseJson.video?.url || responseJson.output?.video?.url;
    const thumbnailUrl = responseJson.thumbnail_url || responseJson.video?.thumbnail || responseJson.output?.thumbnail?.url || null;

    if (!videoUrl) {
      console.error('❌ No video URL in response:', responseJson);
      throw new Error('No video URL in completed response');
    }

    console.log('🎬 Final video URL:', videoUrl);
    console.log('📸 Thumbnail URL:', thumbnailUrl);

    // Prepare update data
    const updateData: any = {
      final_video_url: videoUrl,
      final_video_status: 'completed',
      final_video_completed_at: new Date().toISOString()
    };

    // Store thumbnail in metadata if available
    if (thumbnailUrl) {
      updateData.metadata = {
        ...generation.metadata,
        final_video_thumbnail: thumbnailUrl
      };
    }

    // Update with final video URL and thumbnail
    await supabase
      .from('kie_video_generations')
      .update(updateData)
      .eq('id', generation_id);

    console.log('✅ Video fetched successfully:', videoUrl);

    return new Response(JSON.stringify({
      success: true,
      status: 'completed',
      video_url: videoUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in fal-stitch-callback:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Status check failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
