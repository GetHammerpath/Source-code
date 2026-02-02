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
    const { image_url, industry, avatar_name, city, story_idea, number_of_scenes, duration_per_scene = 10 } = await req.json();
    
    console.log('📸 Analyzing image for Sora with params:', { industry, city, number_of_scenes, duration_per_scene });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    
    const systemPrompt = `You are an expert AI video prompt engineer for OpenAI Sora 2 Pro Storyboard. Create NARRATIVELY COHESIVE video prompts with natural avatar descriptions.

## RULE 1 - NO NAMES IN PROMPTS:
- NEVER use any specific person names in generated prompts
- Describe the person naturally as part of the scene action
- Use: "the presenter", "the professional", "a friendly ${industry} expert"

## RULE 2 - NO RELIGIOUS/CULTURAL TERMS:
- NEVER use: divine, blessed, spiritual, holy, sacred, karma, zen, chakra, priest, church, pastor, minister, temple, mosque
- Use secular terms: "community leader", "neighborhood guide", "local expert"

## RULE 3 - SCENE 1 AVATAR DESCRIPTION:
In Scene 1's visual_prompt, naturally describe the person from the reference image AS PART OF THE SCENE ACTION:
- What they're wearing (clothing style, colors)
- Their general appearance (hair style, build, demeanor)
- Their expression and body language
- Weave this description into the scene narrative - don't list it separately

Example Scene 1 visual_prompt:
"A confident roofing professional in a navy blue company polo and tan work pants stands in a sunny suburban driveway. With a warm smile and direct eye contact, they gesture toward the camera while pointing at a home's aging shingles. Morning light catches their short dark hair as they explain the importance of regular roof inspections..."

## RULE 4 - SCENES 2+ CONTINUITY:
For scenes 2 and onwards, simply refer to "the same presenter" or "the professional" continuing their work. The video generator will maintain visual consistency.

## RULE 5 - SOLO FOCUS:
The presenter must be ALONE in every scene - NO other people, groups, or extras.

## RULE 5b - LIGHTING & CAMERA (Phase 1):
Include explicit lighting (e.g., soft morning light, diffused office lighting, golden hour) and camera style (e.g., static wide shot, subtle handheld feel) in every scene prompt.

## RULE 5c - AVATAR CONSISTENCY CHECKLIST (Phase 1):
Each scene must mention: same clothing, same hair style, same accessories. Same pose/position continuity from previous scene end. No wardrobe or appearance changes between scenes.

## RULE 6 - GOOGLE VEO CONTENT POLICY COMPLIANCE (CRITICAL):
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

## STORY ARC STRUCTURE:
- Scene 1 (HOOK): Establish the presenter (described naturally) and the problem
- Scenes 2-${Math.max(2, number_of_scenes - 1)} (JOURNEY): Show the solution process
- Scene ${number_of_scenes} (RESOLUTION): Deliver the CTA

## JSON OUTPUT STRUCTURE (RETURN ONLY THIS):

{
  "overall_theme": "One sentence about the presenter's ${industry} business in ${city}",
  "image_analysis": {
    "avatar_appearance": {
      "clothing_description": "what they're wearing",
      "general_look": "hair, build, demeanor"
    },
    "environment": {
      "setting": "location type",
      "lighting": "lighting description"
    }
  },
  "shots": [
    {
      "scene_number": 1,
      "scene_purpose": "Hook - Establish problem",
      "visual_prompt": "[Naturally describe the presenter within the scene action, including their clothing and appearance as part of the narrative]",
      "script": "Natural dialogue",
      "connects_to_next": "How this leads to scene 2",
      "duration": ${duration_per_scene}
    },
    {
      "scene_number": 2,
      "scene_purpose": "Journey - Show solution",
      "visual_prompt": "[The same presenter continues... describe the action]",
      "script": "Solution dialogue",
      "connects_to_next": "Transition description",
      "duration": ${duration_per_scene}
    }
  ]
}

CRITICAL: Return ONLY valid JSON. Story idea: ${story_idea || 'General promotional video showcasing expertise'}`;

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
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `Based on this image, create ${number_of_scenes} Sora 2 Pro storyboard scene(s).

Business: ${industry} in ${city}
Story Concept: ${story_idea || 'Showcase expertise and build trust with local customers'}

REQUIREMENTS:
1. In Scene 1, naturally describe the presenter's appearance (clothing, hair, build) as part of the scene action
2. For Scenes 2+, refer to "the same presenter" continuing their work
3. NEVER use any person names - describe them naturally within the action
4. Avoid all religious terminology
5. SOLO FOCUS: The presenter alone in every scene

Return the complete JSON with image_analysis, overall_theme, and shots array.` 
              },
              { 
                type: "image_url", 
                image_url: { url: image_url } 
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      throw new Error('No content generated from OpenAI');
    }

    console.log('🤖 Raw AI response:', generatedText);

    // Parse the JSON response
    let shots, imageAnalysis, overallTheme;
    try {
      // Clean the response (remove markdown code blocks if present)
      let cleanedText = generatedText.trim();
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(cleanedText);
      shots = parsed.shots;
      imageAnalysis = parsed.image_analysis;
      overallTheme = parsed.overall_theme;

      if (!Array.isArray(shots) || shots.length === 0) {
        throw new Error('Invalid shots array in response');
      }

      // Validate and normalize each shot
      shots.forEach((shot: any, index: number) => {
        if (!shot.visual_prompt || typeof shot.visual_prompt !== 'string') {
          throw new Error(`Shot ${index + 1} missing valid visual_prompt field`);
        }
        if (!shot.script || typeof shot.script !== 'string') {
          throw new Error(`Shot ${index + 1} missing valid script field`);
        }
        
        // Handle duration
        if (shot.duration !== undefined && shot.duration !== null) {
          shot.duration = parseInt(String(shot.duration), 10);
        } else {
          shot.duration = duration_per_scene;
        }
        
        // Add scene_number if missing
        if (!shot.scene_number) {
          shot.scene_number = index + 1;
        }
        // Add default scene_purpose if missing
        if (!shot.scene_purpose) {
          if (index === 0) {
            shot.scene_purpose = "Hook - Establish problem";
          } else if (index === shots.length - 1) {
            shot.scene_purpose = "Resolution - CTA";
          } else {
            shot.scene_purpose = "Journey - Show solution";
          }
        }
        // Add default connects_to_next if missing
        if (!shot.connects_to_next && index < shots.length - 1) {
          shot.connects_to_next = "Transitions to next scene";
        }
      });

    } catch (parseError) {
      console.error('❌ Failed to parse AI response:', parseError);
      console.error('Raw response:', generatedText);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
      throw new Error(`Failed to parse Sora scene prompts: ${errorMessage}`);
    }

    console.log('✅ Successfully generated', shots.length, 'Sora scene(s)');

    return new Response(
      JSON.stringify({ 
        success: true, 
        shots: shots,
        image_analysis: imageAnalysis || null,
        overall_theme: overallTheme || null
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Error in analyze-image-sora:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
