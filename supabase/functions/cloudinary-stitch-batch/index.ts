import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let batch_id: string | null = null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? ""
    );

    let body: { batch_id?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    batch_id = body.batch_id ?? null;
    if (!batch_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing batch_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🎬 Batch stitch request for batch:", batch_id);

    // Get batch
    const { data: batch, error: batchError } = await supabase
      .from("bulk_video_batches")
      .select("id, user_id, metadata")
      .eq("id", batch_id)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ success: false, error: `Batch not found: ${batchError?.message || ""}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify batch ownership (JWT user must own the batch)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { createClient: createSupabase } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabaseAuth = createSupabase(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user && batch.user_id !== user.id) {
        return new Response(
          JSON.stringify({ success: false, error: "Not authorized to stitch this batch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Mark stitching in progress
    const meta = (batch.metadata || {}) as Record<string, unknown>;
    await supabase
      .from("bulk_video_batches")
      .update({
        metadata: { ...meta, stitched_video_status: "stitching" },
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch_id);

    // Get all completed videos for this batch, ordered by variation_index
    const { data: links, error: linkError } = await supabase
      .from("bulk_batch_generations")
      .select(`
        generation_id,
        variation_index,
        kie_video_generations(
          id,
          final_video_url,
          initial_video_url
        )
      `)
      .eq("batch_id", batch_id)
      .order("variation_index", { ascending: true });

    if (linkError || !links?.length) {
      await supabase
        .from("bulk_video_batches")
        .update({
          metadata: { ...meta, stitched_video_status: "failed", stitched_video_error: "No videos found for batch" },
          updated_at: new Date().toISOString(),
        })
        .eq("id", batch_id);
      return new Response(
        JSON.stringify({ success: false, error: "No videos found for batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build segments: use final_video_url or initial_video_url per generation
    const segments: Array<{ url: string; duration?: number }> = [];
    for (const link of links) {
      const gen = (link.kie_video_generations as Record<string, unknown>) ?? (link.generation as Record<string, unknown>) ?? {};
      const url = (gen.final_video_url as string) || (gen.initial_video_url as string) || null;
      if (!url || !url.startsWith("http")) continue;
      segments.push({ url, duration: 8000 });
    }

    if (segments.length < 2) {
      await supabase
        .from("bulk_video_batches")
        .update({
          metadata: { ...meta, stitched_video_status: "failed", stitched_video_error: `Need at least 2 completed videos to stitch. Found ${segments.length}.` },
          updated_at: new Date().toISOString(),
        })
        .eq("id", batch_id);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Need at least 2 completed videos to stitch. Found ${segments.length}.`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📤 Processing ${segments.length} batch video segments for concatenation...`);

    const CLOUDINARY_CLOUD_NAME = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const CLOUDINARY_API_KEY = Deno.env.get("CLOUDINARY_API_KEY");
    const CLOUDINARY_API_SECRET = Deno.env.get("CLOUDINARY_API_SECRET");

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      throw new Error("Cloudinary credentials not configured");
    }

    // Download and upload each segment to Cloudinary
    const uploadPromises = segments.map(async (segment, index) => {
      const videoResponse = await fetch(segment.url, {
        method: "GET",
        headers: { Accept: "video/*" },
      });

      if (!videoResponse.ok) {
        throw new Error(`Failed to download segment ${index}: ${videoResponse.status}`);
      }

      const videoBlob = await videoResponse.blob();
      if (!videoBlob || videoBlob.size === 0) {
        throw new Error(`Segment ${index} is empty`);
      }

      const timestamp = Math.round(Date.now() / 1000);
      const publicId = `batch_${batch_id}_seg_${index}`;
      const params = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-1", encoder.encode(params));
      const signature = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const uploadData = new FormData();
      uploadData.append("file", videoBlob, `segment_${index}.mp4`);
      uploadData.append("public_id", publicId);
      uploadData.append("timestamp", timestamp.toString());
      uploadData.append("api_key", CLOUDINARY_API_KEY);
      uploadData.append("signature", signature);
      uploadData.append("resource_type", "video");

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: "POST", body: uploadData }
      );

      if (!uploadResponse.ok) {
        const err = await uploadResponse.text();
        throw new Error(`Cloudinary upload failed for segment ${index}: ${err.substring(0, 200)}`);
      }

      const uploadResult = await uploadResponse.json();
      return { public_id: uploadResult.public_id, index };
    });

    const uploadedSegments = await Promise.all(uploadPromises);
    const baseSegment = uploadedSegments[0].public_id;

    // Build Cloudinary concatenation URL (no trim for batch - each video is a full clip)
    const transformations: string[] = [];
    for (let i = 1; i < uploadedSegments.length; i++) {
      const segId = uploadedSegments[i].public_id;
      transformations.push(`fl_splice,l_video:${segId}`);
      transformations.push("fl_layer_apply");
    }
    const transformationString = transformations.join("/");
    const finalVideoUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${transformationString}/${baseSegment}.mp4`;

    // Save stitched URL to batch metadata
    await supabase
      .from("bulk_video_batches")
      .update({
        metadata: {
          ...meta,
          stitched_video_url: finalVideoUrl,
          stitched_video_status: "completed",
          stitched_video_error: null,
          stitched_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch_id);

    console.log("✅ Batch stitching completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Batch videos stitched successfully",
        video_url: finalVideoUrl,
        segments_count: segments.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in cloudinary-stitch-batch:", error);
    const errorMessage = error instanceof Error ? error.message : "Stitching failed";

    if (batch_id) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? ""
        );
        const { data: batch } = await supabase
          .from("bulk_video_batches")
          .select("metadata")
          .eq("id", batch_id)
          .single();
        const meta = ((batch?.metadata as Record<string, unknown>) || {}) as Record<string, unknown>;
        await supabase
          .from("bulk_video_batches")
          .update({
            metadata: { ...meta, stitched_video_status: "failed", stitched_video_error: errorMessage },
            updated_at: new Date().toISOString(),
          })
          .eq("id", batch_id);
      } catch {
        /* ignore */
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        batch_id: batch_id ?? null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
