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

    let body: any;
    try {
      body = await req.json();
    } catch (jsonError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    generation_id = body.generation_id;
    if (!generation_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing generation_id in request body'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const trim = body.trim ?? false;
    const trimSeconds = body.trim_seconds ?? 1;

    // Validate trim_seconds is within reasonable range
    if (trim && (trimSeconds < 0.1 || trimSeconds > 5)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Trim duration must be between 0.1 and 5 seconds'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🎬 Cloudinary stitch request for generation:', generation_id);
    console.log('🎬 Trim mode:', trim);
    console.log('🎬 Trim seconds:', trimSeconds);
    console.log('🎬 Request body:', JSON.stringify(body, null, 2));

    // Get generation record
    const { data: generation, error: fetchError } = await supabase
      .from('kie_video_generations')
      .select('*')
      .eq('id', generation_id)
      .single();

    if (fetchError || !generation) {
      return new Response(JSON.stringify({
        success: false,
        error: `Generation not found: ${fetchError?.message || 'No generation record'}`
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate segments
    const segments = generation.video_segments || [];
    console.log('🎬 Video segments:', JSON.stringify(segments, null, 2));
    console.log('🎬 Segments count:', segments.length);
    console.log('🎬 Generation status:', {
      initial_status: generation.initial_status,
      extended_status: generation.extended_status,
      number_of_scenes: generation.number_of_scenes,
      segments_length: segments.length
    });
    
    if (segments.length < 2) {
      const errorMsg = `Need at least 2 video segments to stitch. Found ${segments.length} segment(s).`;
      console.error('❌ Validation failed:', errorMsg);
      console.error('❌ Generation state:', {
        generation_id: generation.id,
        segments: segments.map((s: any, i: number) => ({
          index: i,
          has_url: !!(s.url || s.video_url),
          url: s.url || s.video_url || 'MISSING',
          status: s.status || 'unknown'
        }))
      });
      return new Response(JSON.stringify({
        success: false,
        error: errorMsg,
        segments_count: segments.length,
        segments: segments.map((s: any, i: number) => ({
          index: i,
          has_url: !!(s.url || s.video_url),
          url: s.url || s.video_url || null,
          status: s.status || 'unknown'
        }))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate all segments have URLs (check both 'url' and 'video_url' fields)
    const segmentsWithUrls = segments.map((seg: any, index: number) => {
      const url = seg.url || seg.video_url;
      if (!url) {
        return { index, segment: seg, error: 'Missing URL' };
      }
      return { index, segment: seg, url };
    });

    const invalidSegment = segmentsWithUrls.find((s: any) => s.error);
    if (invalidSegment) {
      const errorMsg = `Segment ${invalidSegment.index} is missing a URL`;
      console.error('❌ Validation failed:', errorMsg);
      console.error('❌ Invalid segment data:', JSON.stringify(invalidSegment.segment, null, 2));
      console.error('❌ All segments:', segmentsWithUrls.map((s: any) => ({
        index: s.index,
        has_url: !!s.url,
        url: s.url || 'MISSING',
        error: s.error || null
      })));
      return new Response(JSON.stringify({
        success: false,
        error: errorMsg,
        segment_index: invalidSegment.index,
        segment_data: invalidSegment.segment,
        all_segments: segmentsWithUrls.map((s: any) => ({
          index: s.index,
          has_url: !!s.url,
          url: s.url || null,
          error: s.error || null
        }))
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Normalize segments to use 'url' field
    const normalizedSegments = segmentsWithUrls.map((s: any) => ({
      ...s.segment,
      url: s.url
    }));

    // Get Cloudinary credentials
    const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const CLOUDINARY_API_KEY = Deno.env.get('CLOUDINARY_API_KEY');
    const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary credentials not configured');
    }

    console.log(`📤 Processing ${normalizedSegments.length} video segments for concatenation...`);

    // Download and upload segments to Cloudinary (required for concatenation)
    const uploadPromises = normalizedSegments.map(async (segment: any, index: number) => {
      try {
        // First, download the video from the URL
        console.log(`📥 Downloading segment ${index} from: ${segment.url}`);
        
        if (!segment.url || !segment.url.startsWith('http')) {
          throw new Error(`Segment ${index} has invalid URL: ${segment.url || 'missing'}`);
        }

        const videoResponse = await fetch(segment.url, {
          method: 'GET',
          headers: {
            'Accept': 'video/*',
          },
        });
        
        if (!videoResponse.ok) {
          const errorText = await videoResponse.text().catch(() => '');
          throw new Error(`Failed to download segment ${index}: ${videoResponse.status} ${videoResponse.statusText}. ${errorText.substring(0, 200)}`);
        }

        const videoBlob = await videoResponse.blob();
        
        if (!videoBlob || videoBlob.size === 0) {
          throw new Error(`Segment ${index} downloaded but file is empty (0 bytes)`);
        }
        
        console.log(`✅ Downloaded segment ${index} (${videoBlob.size} bytes)`);

        // Now upload to Cloudinary using signed upload
        const timestamp = Math.round(Date.now() / 1000);
        const publicId = `video_${generation_id}_segment_${index}`;
        
        // Create signature for signed upload
        const params = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(params);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const uploadData = new FormData();
        uploadData.append('file', videoBlob, `segment_${index}.mp4`);
        uploadData.append('public_id', publicId);
        uploadData.append('timestamp', timestamp.toString());
        uploadData.append('api_key', CLOUDINARY_API_KEY);
        uploadData.append('signature', signature);
        uploadData.append('resource_type', 'video');

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
          {
            method: 'POST',
            body: uploadData,
          }
        );

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => 'Unknown error');
          console.error(`❌ Cloudinary upload failed for segment ${index}:`, errorText);
          throw new Error(`Failed to upload segment ${index} to Cloudinary (${uploadResponse.status}): ${errorText.substring(0, 500)}`);
        }

        const uploadResult = await uploadResponse.json();
        console.log(`✅ Uploaded segment ${index} to Cloudinary: ${uploadResult.public_id}`);
        
        return {
          public_id: uploadResult.public_id,
          index: index
        };
      } catch (error) {
        console.error(`❌ Error processing segment ${index}:`, error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        // Return detailed error with segment info
        throw new Error(`Segment ${index} failed: ${errorMsg}. URL: ${segment.url || 'missing'}`);
      }
    });

    let uploadedSegments;
    try {
      uploadedSegments = await Promise.all(uploadPromises);
      console.log('✅ All segments uploaded to Cloudinary');
    } catch (uploadError) {
      const errorMsg = uploadError instanceof Error ? uploadError.message : 'Failed to upload segments';
      console.error('❌ Segment upload failed:', errorMsg);
      return new Response(JSON.stringify({
        success: false,
        error: errorMsg,
        details: 'One or more video segments failed to download or upload to Cloudinary. Check segment URLs are accessible.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build Cloudinary transformation URL for video concatenation
    console.log('🔗 Building transformation URL for concatenation...');

    // Start with the first segment as base
    const baseSegment = uploadedSegments[0].public_id;
    
    // Build transformation layers for additional segments
    const transformations: string[] = [];
    
    for (let i = 1; i < uploadedSegments.length; i++) {
      const segmentId = uploadedSegments[i].public_id;
      
      // Build transformation: fl_splice,l_video:segment_id,so_{trimSeconds}/fl_layer_apply
      const parts = ['fl_splice', `l_video:${segmentId}`];
      
      // Apply start_offset for trimming if enabled
      if (trim) {
        parts.push(`so_${trimSeconds}`);
      }
      
      transformations.push(parts.join(','));
      transformations.push('fl_layer_apply');
    }
    
    // Construct the full transformation URL
    const transformationString = transformations.join('/');
    const finalVideoUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${transformationString}/${baseSegment}.mp4`;

    console.log('🎥 Final video URL:', finalVideoUrl);

    // Update database with final video URL
    const { error: updateError } = await supabase
      .from('kie_video_generations')
      .update({
        final_video_url: finalVideoUrl,
        final_video_status: 'completed',
        final_video_completed_at: new Date().toISOString(),
        is_final: true
      })
      .eq('id', generation_id);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Video stitching completed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Videos combined successfully',
      video_url: finalVideoUrl
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('❌ Error in cloudinary-stitch-videos:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Stitching failed';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const isConfigError = errorMessage.includes('not configured') || errorMessage.includes('credentials');
    
    // Log full error details
    console.error('Full error details:', {
      message: errorMessage,
      stack: errorStack,
      generation_id,
      error_type: error?.constructor?.name
    });
    
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
            final_video_error: errorMessage
          })
          .eq('id', generation_id);
      } catch (dbError) {
        console.error('Failed to update error in database:', dbError);
      }
    }

    // Return appropriate status code
    const statusCode = isConfigError ? 500 : 400;
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      details: isConfigError 
        ? 'Cloudinary credentials are missing. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Supabase secrets.'
        : 'Check Edge Function logs for detailed error information.',
      generation_id: generation_id || null
    }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
