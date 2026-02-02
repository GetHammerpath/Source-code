import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { image_url, avatar_name, industry, city, story_idea, number_of_scenes, duration_per_scene } = await req.json();

    console.log('Analyzing image for Runway Extend:', { industry, city, number_of_scenes, duration_per_scene });

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert at analyzing images and creating video prompts for Runway's extend feature.

## RULE 1 - NO NAMES IN PROMPTS:
- NEVER use any specific person names, character names, or proper nouns for people
- Describe the person naturally as part of the scene action
- Use: "the presenter", "the professional", "a friendly ${industry} expert"

## RULE 2 - SCENE 1 AVATAR DESCRIPTION:
In Scene 1's prompt, naturally describe the person from the reference image AS PART OF THE SCENE ACTION:
- What they're wearing (clothing style, colors)
- Their general appearance (hair style, build)
- Their expression and demeanor
- Weave this into the scene narrative - don't list it separately

Example Scene 1 prompt:
"A friendly home service professional in a crisp navy blue polo shirt and tan work pants stands confidently in a well-lit suburban kitchen. Their short dark hair is neatly styled as they gesture toward a ceiling water stain, speaking directly to the camera with a reassuring smile. Warm morning light streams through the window behind them..."

## RULE 3 - SCENES 2+ CONTINUITY:
For scenes 2 and onwards, simply refer to "the same presenter" or "the professional" continuing their work. Runway's extend feature will maintain visual consistency from the previous video frame.

## RULE 4 - RUNWAY EXTEND SPECIFIC:
- Each scene extends from the LAST FRAME of the previous video
- Visual continuity is maintained by the extend feature
- Focus on describing the ACTION and SETTING for each scene
- Keep the presenter as the central focus in EVERY scene

## RULE 5 - GOOGLE VEO CONTENT POLICY COMPLIANCE (CRITICAL):
Your prompts and scripts MUST AVOID these categories that trigger video generation rejection:

❌ NEVER INCLUDE:
- Violence, weapons, fighting, blood, injuries, or threatening behavior
- Sexual or suggestive content, revealing clothing, or intimate situations
- Toxic, hate speech, discriminatory language, or offensive stereotypes
- Vulgar language, profanity, or crude humor
- Real celebrity names, famous politicians, or public figures
- Personal information (phone numbers, addresses, credit cards)
- Children or minors in any context
- Dangerous activities (illegal acts, self-harm, drug use)
- Religious/political controversy or symbols

✅ ALWAYS USE:
- Professional, business-appropriate language only
- Positive, constructive, educational messaging
- Generic professional descriptors ("a business professional", "the presenter")
- Safe, workplace-appropriate scenarios
- Educational and informative tone
- Neutral, welcoming commercial settings

IMPORTANT: If the story_idea contains any problematic content, REPHRASE it professionally.

## RULE 5b - LIGHTING & CAMERA (Phase 1):
Include explicit lighting (e.g., soft morning light, diffused office lighting, golden hour) and camera style (e.g., static wide shot, subtle handheld feel) in every scene prompt.

## RULE 5c - AVATAR CONSISTENCY CHECKLIST (Phase 1):
Each scene must mention: same clothing, same hair style, same accessories. Same pose/position continuity from previous scene end. No wardrobe or appearance changes between scenes.

## RULE 6 - NO ON-SCREEN TEXT (MANDATORY):
- NO captions, subtitles, or text overlays in any scene
- NO visible text, titles, or graphics with words
- NO signs, labels, or written content in the video
- Dialogue/narration is audio only - never display spoken words as text on screen

## OUTPUT FORMAT (JSON):

{
  "image_analysis": {
    "avatar": {
      "clothing": "what they're wearing",
      "appearance": "general look - hair, build",
      "demeanor": "expression, body language"
    },
    "environment": {
      "setting": "location type",
      "lighting": "lighting description"
    }
  },
  "scenes": [
    {
      "scene_number": 1,
      "prompt": "[Naturally describe the presenter within the scene action, including their clothing and appearance as part of the narrative]",
      "script": "[Narration script for this scene]",
      "camera": "[Camera movement description]",
      "duration": ${duration_per_scene || 5}
    },
    {
      "scene_number": 2,
      "prompt": "[The same presenter continues... describe the action and setting]",
      "script": "...",
      "camera": "...",
      "duration": ${duration_per_scene || 5}
    }
  ],
  "overall_theme": "Brief theme description"
}`;

    const userPrompt = `Based on this image, create ${number_of_scenes} scene prompts for a ${industry} promotional video using Runway's extend feature.

**Industry**: ${industry}
**Location**: ${city}
**Story Idea**: ${story_idea || 'Create an engaging promotional story'}
**Duration Per Scene**: ${duration_per_scene || 5} seconds

REQUIREMENTS:
1. In Scene 1, naturally describe the presenter's appearance (clothing, hair, build) as part of the scene action
2. For Scenes 2+, refer to "the same presenter" continuing their work
3. NEVER use any person names - describe them naturally within the action
4. Each scene extends from the LAST FRAME of the previous video - maintain narrative flow
5. Keep the presenter as the central focus in EVERY scene
6. Create a compelling story arc`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: image_url } }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log('🤖 Raw AI response:', content);

    // Parse JSON from the response
    let parsedResponse;
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanedText = content.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      console.log('Raw response:', content);
      throw new Error('Failed to parse image analysis response');
    }

    console.log('✅ Successfully analyzed image with', parsedResponse.scenes?.length || 0, 'scenes');

    return new Response(JSON.stringify({
      success: true,
      ...parsedResponse
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in runway-extend-analyze:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
