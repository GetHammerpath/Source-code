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
    const { script, number_of_scenes } = await req.json();

    if (!script || !number_of_scenes) {
      return new Response(
        JSON.stringify({ success: false, error: 'Script and number_of_scenes required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Build prompt to break script into scenes
    const systemPrompt = `You are an expert video producer. Your task is to break down a video script into ${number_of_scenes} distinct scenes.

Each scene should:
- Be approximately 8 seconds long when rendered
- Have a clear title and description
- Include visual prompts suitable for AI video generation
- Flow naturally from one scene to the next
- Maintain narrative coherence

Return a JSON array of scenes with this structure:
[
  {
    "scene_number": 1,
    "title": "Scene Title",
    "prompt": "Detailed visual description for AI video generation"
  },
  ...
]`;

    const userPrompt = `Break this script into exactly ${number_of_scenes} scenes:

SCRIPT:
${script}

Create ${number_of_scenes} scenes with clear titles and detailed visual prompts. Return a JSON object with a "scenes" array containing objects with "scene_number", "title", and "prompt" properties.`;

    // Call OpenAI to generate storyboard
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
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const generatedContent = data.choices?.[0]?.message?.content;

    if (!generatedContent) {
      throw new Error('No storyboard generated from OpenAI');
    }

    // Parse JSON response
    let parsed;
    try {
      // Try to extract JSON if wrapped in markdown
      let jsonText = generatedContent.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('❌ Failed to parse storyboard response:', parseError);
      console.error('Raw response:', generatedContent);
      throw new Error('Failed to parse AI response. Please try again.');
    }

    // Extract scenes array (could be in scenes property, root array, or wrapped object)
    let scenes: any[] = [];
    if (Array.isArray(parsed)) {
      scenes = parsed;
    } else if (parsed.scenes && Array.isArray(parsed.scenes)) {
      scenes = parsed.scenes;
    } else if (parsed.scene_list && Array.isArray(parsed.scene_list)) {
      scenes = parsed.scene_list;
    } else {
      // Try to find any array property
      for (const key in parsed) {
        if (Array.isArray(parsed[key])) {
          scenes = parsed[key];
          break;
        }
      }
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      throw new Error('Invalid storyboard format: expected array of scenes');
    }

    console.log(`✅ Storyboard created with ${scenes.length} scenes`);

    return new Response(
      JSON.stringify({
        success: true,
        scenes: scenes,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error creating storyboard:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create storyboard'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
