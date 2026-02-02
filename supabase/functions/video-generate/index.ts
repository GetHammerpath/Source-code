/**
 * Video generation router - routes to the appropriate backend based on model.
 * Phase 2: Unified entry point for Studio and Bulk.
 * Phase 4: Added fallback/retry logic when primary model fails.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Models that use Kie.ai Veo (kie-generate-video)
const KIE_VEO_MODELS = ["veo3_fast", "veo3"];

// Models that use Kie.ai Sora2 (sora2-generate-video) - Phase 3
const KIE_SORA2_MODELS = ["sora2_pro_720", "sora2_pro_1080"];

// Models that use Kie.ai Kling - Phase 3
const KIE_KLING_MODELS = ["kling_2_6"];

// Phase 4: Fallback model chain (primary -> fallback)
const FALLBACK_MODELS: Record<string, string> = {
  veo3_fast: "sora2_pro_720",
  veo3: "veo3_fast",
  sora2_pro_720: "veo3_fast",
  sora2_pro_1080: "sora2_pro_720",
  kling_2_6: "veo3_fast",
};

// Phase 4: Error types that trigger fallback
const FALLBACK_ERROR_TYPES = [
  "CONTENT_POLICY",
  "RATE_LIMIT",
  "MODEL_UNAVAILABLE",
  "PROVIDER_ERROR",
];

// Phase 4: Helper to get the target function URL for a model
function getTargetUrl(supabaseUrl: string, model: string): string | null {
  if (KIE_VEO_MODELS.includes(model)) {
    return `${supabaseUrl}/functions/v1/kie-generate-video`;
  }
  if (KIE_SORA2_MODELS.includes(model)) {
    return `${supabaseUrl}/functions/v1/sora2-generate-video`;
  }
  if (KIE_KLING_MODELS.includes(model)) {
    return `${supabaseUrl}/functions/v1/kie-kling-generate-video`;
  }
  return null;
}

// Phase 4: Check if an error should trigger fallback
function shouldTriggerFallback(errorData: Record<string, unknown>): { should: boolean; reason: string } {
  const errorType = (errorData.error_type as string) || "";
  const error = (errorData.error as string) || "";
  
  // Check for specific error types
  if (FALLBACK_ERROR_TYPES.includes(errorType)) {
    return { should: true, reason: errorType.toLowerCase() };
  }
  
  // Check for content policy errors in the message
  if (error.toLowerCase().includes("content policy") || error.toLowerCase().includes("safety")) {
    return { should: true, reason: "content_policy" };
  }
  
  // Check for rate limit errors
  if (error.toLowerCase().includes("rate limit") || error.toLowerCase().includes("too many requests")) {
    return { should: true, reason: "rate_limit" };
  }
  
  // Check for provider/API errors
  if (error.toLowerCase().includes("provider") || error.toLowerCase().includes("api error")) {
    return { should: true, reason: "provider_error" };
  }
  
  return { should: false, reason: "" };
}

// Phase 4: Check if model supports the generation type
function modelSupportsGenType(model: string, hasImage: boolean): boolean {
  // Sora2 and Kling only support image-to-video
  if (KIE_SORA2_MODELS.includes(model) || KIE_KLING_MODELS.includes(model)) {
    return hasImage;
  }
  // Veo supports both
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Missing SUPABASE_URL or service role key",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Unauthorized: No authorization header",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestedModel = (body.model as string) || "veo3_fast";
    const hasImage = !!(body.image_url && body.image_url !== "text-only-mode");
    const enableFallback = body.enable_fallback !== false; // Default to true
    const maxRetries = Math.min(3, Number(body.max_retries) || 2);
    
    let currentModel = requestedModel;
    let retryCount = 0;
    let lastError: Record<string, unknown> | null = null;
    let fallbackReason = "";

    // Phase 4: Try model with fallback chain
    while (retryCount <= maxRetries) {
      const targetUrl = getTargetUrl(supabaseUrl, currentModel);
      
      if (!targetUrl) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Unknown model "${currentModel}". Supported: ${[...KIE_VEO_MODELS, ...KIE_SORA2_MODELS, ...KIE_KLING_MODELS].join(", ")}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Phase 4: Check if model supports generation type
      if (!modelSupportsGenType(currentModel, hasImage)) {
        console.log(`⚠️ Model ${currentModel} doesn't support ${hasImage ? "image" : "text"}-to-video, trying fallback`);
        const fallback = FALLBACK_MODELS[currentModel];
        if (fallback && enableFallback) {
          currentModel = fallback;
          retryCount++;
          fallbackReason = "unsupported_gen_type";
          continue;
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: `Model ${currentModel} doesn't support ${hasImage ? "" : "text-to-video ("}${hasImage ? "current generation type" : "no image provided)"}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`🎬 Routing to ${currentModel} (attempt ${retryCount + 1}/${maxRetries + 1})`);

      // Add metadata for fallback tracking
      const requestBody = {
        ...body,
        model: currentModel,
        _original_model: retryCount > 0 ? requestedModel : undefined,
        _retry_count: retryCount,
        _fallback_reason: fallbackReason || undefined,
      };

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(requestBody),
      });

      const text = await res.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        data = { success: false, error: text || `Invalid response from ${currentModel}` };
      }

      // Success - return the response
      if (res.ok && data.success) {
        // Add fallback info to response if we used fallback
        if (retryCount > 0) {
          data.fallback_used = true;
          data.original_model = requestedModel;
          data.fallback_model = currentModel;
          data.fallback_reason = fallbackReason;
          console.log(`✅ Success with fallback: ${requestedModel} -> ${currentModel} (reason: ${fallbackReason})`);
        }
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Error - check if we should fallback
      lastError = data;
      const { should: shouldFallback, reason } = shouldTriggerFallback(data);
      
      if (shouldFallback && enableFallback) {
        const fallback = FALLBACK_MODELS[currentModel];
        if (fallback && retryCount < maxRetries) {
          console.log(`⚠️ ${currentModel} failed (${reason}), falling back to ${fallback}`);
          fallbackReason = reason;
          currentModel = fallback;
          retryCount++;
          continue;
        }
      }

      // No fallback available or disabled - return the error
      console.error(`❌ ${currentModel} failed with no fallback available:`, data.error);
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Max retries exceeded
    return new Response(
      JSON.stringify({
        success: false,
        error: `All models failed after ${retryCount} attempts. Last error: ${lastError?.error || "Unknown"}`,
        attempted_models: [requestedModel, ...Object.keys(FALLBACK_MODELS).filter(m => m !== requestedModel).slice(0, retryCount)],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Error in video-generate router:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Video generation router failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
