import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_WEBHOOK_URL = "https://hammerpath.app.n8n.cloud/webhook/e82369d8-9103-4edf-8e95-d3371ecf23d0";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json();
    
    console.log('Triggering n8n workflow for request:', requestData.request_id);

    // Prepare callback URL for n8n to send results back
    const callbackUrl = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/handle-n8n-callback`;
    
    // Send data to n8n webhook
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        request_id: requestData.request_id,
        title: requestData.title,
        caption: requestData.caption,
        story_idea: requestData.story_idea,
        company_name: requestData.company_name,
        company_type: requestData.company_type,
        character: requestData.character,
        visual_style: requestData.visual_style,
        colors: requestData.colors,
        special_request: requestData.special_request,
        gender_avatar: requestData.gender_avatar,
        image_reference: requestData.image_reference || [],
        scenes: requestData.scenes,
        aspect_ratio: requestData.aspect_ratio,
        render_mode: requestData.render_mode,
        created_at: requestData.created_at,
        callback_url: callbackUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook returned ${response.status}`);
    }

    const result = await response.json();
    console.log('n8n workflow triggered successfully:', result);

    return new Response(
      JSON.stringify({ success: true, message: 'Workflow triggered successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error triggering n8n workflow:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
