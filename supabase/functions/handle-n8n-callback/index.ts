import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData = await req.json();
    console.log('Received callback from n8n:', JSON.stringify(requestData, null, 2));

    // Extract data from n8n callback
    // n8n sends an array with a single object
    const callbackData = Array.isArray(requestData) ? requestData[0] : requestData;
    const { request_id, final_output, production_status, title } = callbackData;

    if (!request_id) {
      console.error('Missing request_id in callback data');
      return new Response(
        JSON.stringify({ error: 'Missing request_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Updating video request ${request_id} with status: ${production_status}`);

    // Determine the status based on production_status
    let status = 'queued';
    if (production_status === 'done') {
      status = 'completed';
    } else if (production_status === 'processing') {
      status = 'processing';
    } else if (production_status === 'failed') {
      status = 'failed';
    }

    // Update the video request in the database
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Add video URL if completed
    if (final_output && status === 'completed') {
      updateData.video_url = final_output;
      updateData.completed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('video_requests')
      .update(updateData)
      .eq('id', request_id)
      .select();

    if (error) {
      console.error('Error updating video request:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to update video request', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully updated video request:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Video request updated successfully',
        data 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in handle-n8n-callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
