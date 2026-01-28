import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { input_type, input } = await req.json();

    if (!input || !input_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Input and input_type required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Build prompt based on input type
    const systemPrompt = `You are an expert video script writer. Your task is to create a complete, professional video script from limited input.

The script should:
- Be engaging and professional
- Have clear scene breaks
- Be suitable for long-form video (5-60 minutes)
- Include natural dialogue and action descriptions
- Be structured for multi-scene video production

Format the script with clear scene markers and descriptions.`;

    let userPrompt = '';
    
    if (input_type === 'brief') {
      userPrompt = `Create a complete video script based on this brief:

"${input}"

Generate a detailed, production-ready script with clear scene breaks and descriptions.`;
    } else if (input_type === 'url') {
      userPrompt = `Extract content from this URL and create a complete video script:

URL: ${input}

Create a detailed, production-ready script suitable for long-form video production with clear scene breaks.`;
    } else if (input_type === 'transcript') {
      userPrompt = `Transform this podcast transcript into a professional video script:

TRANSCRIPT:
${input}

Restructure the content into a detailed video script with clear scene breaks, natural dialogue, and visual descriptions.`;
    }

    // Call OpenAI to generate script
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const generatedScript = data.choices?.[0]?.message?.content;

    if (!generatedScript) {
      throw new Error('No script generated from OpenAI');
    }

    console.log('✅ Script generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        script: generatedScript,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error generating script:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate script'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
