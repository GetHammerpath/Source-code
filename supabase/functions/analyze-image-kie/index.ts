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
    const { image_url, industry, avatar_name, city, story_idea, number_of_scenes = 1 } = await req.json();

    // Detect text-only mode (no image provided)
    const isTextOnlyMode = !image_url || image_url === null || image_url === '';
    console.log('🎬 Mode:', isTextOnlyMode ? 'TEXT_ONLY (no image)' : 'IMAGE_ANALYSIS');
    console.log('📝 Details:', { industry, avatar_name, city, story_idea, number_of_scenes });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Build system prompt based on number of scenes and mode
    let systemPrompt = '';
    
    if (number_of_scenes === 1) {
      // Single scene prompt
      systemPrompt = `You are an expert video prompt writer specializing in creating compelling, cinematic 8-second video descriptions. Your goal is to create a prompt that will generate an engaging business video.

Key requirements:
- Duration: Exactly 8 seconds of content
- Subject: ${avatar_name} as the main character
- Setting: ${industry} business in ${city}
- Style: Professional, cinematic, dynamic
- Action: Include specific movements and activities
- Details: Mention lighting, camera angles, and atmosphere
${isTextOnlyMode ? `- Avatar: Imagine ${avatar_name} as a confident, professional ${industry} expert with polished business attire` : ''}

Create a single, detailed prompt that describes a complete 8-second video scene.`;
    } else {
      // Multi-scene prompt with avatar consistency and marketing focus
      const avatarDescription = isTextOnlyMode 
        ? `Imagine ${avatar_name} as a confident, professional ${industry} expert. They wear polished business attire appropriate for ${industry}, have a warm and approachable demeanor, and exude expertise and trustworthiness.`
        : `Note the presenter's professional appearance, attire, and style from the reference image for video continuity`;

      systemPrompt = `You are an expert digital marketing video creator specializing in compelling, conversion-focused video stories with SEAMLESS CINEMATIC TRANSITIONS and PERSUASIVE NARRATION.

CONTENT GUIDELINES (IMPORTANT):
- This is for professional marketing video production
- Focus on professional attire, style, and presence
- Describe the presenter naturally as part of the scene action
- Avoid sensitive physical descriptions - focus on clothing, posture, and professional demeanor

## GOOGLE VEO CONTENT POLICY COMPLIANCE (CRITICAL):
Your prompts and scripts MUST AVOID these categories that trigger video generation rejection:

❌ NEVER INCLUDE:
- Violence, weapons, blood, or threatening behavior
- Sexual, suggestive, or revealing content
- Hate speech, discriminatory language, or offensive stereotypes
- Vulgar language or crude humor
- Real celebrities, politicians, or public figures
- Personal information
- Children or minors
- Dangerous or illegal activities
- Religious or political controversy or symbols
- Financial, legal, or medical advice

✅ ALWAYS USE:
- Professional, business-appropriate language only
- Positive, constructive, educational messaging
- Generic professional descriptors ("a business professional", "the presenter")
- Safe, workplace-appropriate scenarios
- Educational and informative tone
- Neutral, welcoming commercial settings

IMPORTANT: If the story_idea contains any problematic content, REPHRASE it professionally. Never include restricted content even if requested.

MARKETING STORY CONCEPT:
"${story_idea}"

CRITICAL - Avatar & Visual Consistency:
1. ${avatarDescription}
2. EVERY scene must feature THE SAME presenter: "${avatar_name}" maintaining their exact professional look and attire
3. Maintain consistent appearance across ALL scenes through clothing, style, and professional presence
4. **SOLO FOCUS**: ${avatar_name} must be the ONLY person in every scene - NO additional people, groups, or extras

SEAMLESS TRANSITION REQUIREMENTS (CRITICAL):
Each scene must be designed for perfect video-to-video flow:

✓ **Scene Endings**: Describe the final position, camera angle, and action that leads into the next scene
✓ **Scene Beginnings**: Match the previous scene's ending position/angle/lighting exactly
✓ **Motion Continuity**: Actions should flow naturally (e.g., Scene 1 ends walking toward door → Scene 2 begins entering door)
✓ **Visual Bridges**: Use environmental/lighting consistency to connect scenes
✓ **Narrative Flow**: Each scene's ending moment should create anticipation for the next

AVATAR SCRIPT REQUIREMENTS (NEW - CRITICAL):
Each scene needs compelling DIALOGUE that ${avatar_name} speaks directly to camera/viewer:

**Script Guidelines:**
- **Length**: 1-3 sentences per scene (fits naturally in 8 seconds)
- **Tone**: Conversational, authentic, NOT robotic or overly formal
- **Industry-specific**: Use ${industry} terminology naturally
- **Marketing Structure**:
  * Scene 1: Hook with problem/pain point ("Are you dealing with...")
  * Scene 2-${number_of_scenes - 1}: Solution benefits ("Here's how we...")
  * Scene ${number_of_scenes}: Call-to-action ("Let's transform your...")
- **Connection**: Script should align with visual action and story progression
- **Authenticity**: Sounds like a real ${industry} professional in ${city}, not a salesperson

VOICE DELIVERY REQUIREMENTS (CRITICAL FOR NATURAL AUDIO):
Each scene's script must include implicit voice delivery guidance:

**Voice Character for ${avatar_name}:**
- Warm, confident, genuinely conversational - like speaking to a trusted colleague
- Crystal clear articulation, every word distinctly pronounced
- Natural speaking rhythm with appropriate pauses between thoughts
- Professional enthusiasm without sounding salesy or robotic
- Sounds like a real ${industry} expert, not a text-to-speech bot

**Anti-Robotic Rules:**
- NO monotone delivery - vary pitch naturally throughout
- NO rushed speech - take natural pauses between sentences
- NO mechanical cadence - avoid evenly-spaced word delivery
- NO over-enunciation - speak conversationally, not like reading a script

**Natural Speech Patterns:**
- Brief pauses after important points for emphasis
- Slight emphasis on key benefit words
- Warm smile in the voice (audible friendliness)
- Natural breath between sentences
- Use conversational contractions (don't, we're, you'll, it's)

**Scene-Specific Voice Guidance:**
- Scene 1 (Hook): Open with engaging, slightly curious tone. Build connection - speak directly TO viewer like a friend.
- Middle Scenes (Solution): Confident but not pushy. Maintain same warm energy as Scene 1.
- Final Scene (CTA): Warm invitation, not aggressive sales pitch. End with friendly, welcoming tone.

DIGITAL MARKETING STRUCTURE (${number_of_scenes} scenes):

**Scene 1 (Hook/Problem) - 8 seconds:**
- Opening: ${avatar_name} (professional ${industry} expert) in ${industry} context in ${city}
- Hook: Present the problem/challenge immediately
- Action: Dynamic movement, professional lighting
- **SCRIPT**: Hook dialogue addressing viewer's problem/need
- **ENDING TRANSITION**: Describe ${avatar_name}'s final position/action that leads into Scene 2
- Example ending: "Camera follows ${avatar_name} as they turn toward [next location], setting up the next scene"

**Scene 2-${number_of_scenes - 1} (Solution/Action) - 8 seconds each:**
- **OPENING TRANSITION**: "Seamlessly continue from the previous scene. ${avatar_name} (same professional appearance) now [picks up where we left off]"
- **SOLO FOCUS**: ${avatar_name} working ALONE - no additional people, clients, or team members
- Solution: Show the process, service, transformation in ${industry} with ${avatar_name} as sole focus
- **SCRIPT**: Solution-focused dialogue explaining value/benefits
- Maintain avatar consistency and visual style
- **ENDING TRANSITION**: Position ${avatar_name} for the next scene with clear motion/position continuity

**Scene ${number_of_scenes} (Result/CTA) - 8 seconds:**
- **OPENING TRANSITION**: "Continue seamlessly from Scene ${number_of_scenes - 1}. ${avatar_name} (same person) now completes the journey"
- **SOLO FOCUS**: ${avatar_name} ALONE - no groups, no additional people, no crowds
- Result: Show ${avatar_name} individually expressing satisfaction, success, transformation
- Action: ${avatar_name} confidently gesturing, speaking to camera, or welcoming viewers (ALONE)
- **SCRIPT**: Strong call-to-action with contact info or next step
- Professional presence and confidence
- **ENDING**: Strong closing visual with ${avatar_name} in final satisfied state (SOLO)

MANDATORY PROMPT ELEMENTS FOR EACH SCENE:

1. **Avatar Consistency Block** (start of every prompt):
   "Show ${avatar_name}, a professional ${industry} expert in polished business attire, maintaining identical appearance throughout"

2. **Transition Entry** (scenes 2+):
   "Seamlessly continuing from the previous video, ${avatar_name} now [action]. Match the lighting, camera angle, and ${avatar_name}'s position from where the last scene ended"

3. **Core Action** (middle):
   "[8 seconds of specific marketing-focused action in ${industry} context in ${city}]"

4. **Transition Exit** (scenes 1 to N-1):
   "The scene concludes with ${avatar_name} [specific ending position/action that leads into next scene], setting up a smooth transition"

5. **Technical Details**:
   - Lighting consistency across transitions
   - Camera angle matching at transition points
   - Motion continuity (no abrupt stops/starts)
   - Environmental consistency (same location style if continuing in same area)

TONE & CINEMATIC STYLE:
- Professional, dynamic, authentic
- Smooth camera movements (no jarring cuts)
- Consistent lighting and color grading across scenes
- Natural motion flow (walking, turning, gesturing continues across scene boundaries)

Return EXACTLY ${number_of_scenes} prompts in this JSON format:
{
  "scenes": [
    {
      "scene_number": 1,
      "prompt": "Show ${avatar_name}, a professional ${industry} expert in polished business attire, [8-second hook/problem action] in ${industry} in ${city}. [Lighting and camera details]. Scene ends with ${avatar_name} [transition position] leading smoothly into the next scene.",
      "script": "Dialogue that ${avatar_name} speaks in this scene - conversational, authentic, addresses the problem/hook. 1-3 sentences max."
    },
    {
      "scene_number": 2,
      "prompt": "Seamlessly continuing from the previous scene, ${avatar_name} (same professional appearance maintained) now [solution action]. Match the position and lighting from where Scene 1 ended. [8-second dynamic action]. Scene concludes with ${avatar_name} [transition setup for Scene 3].",
      "script": "Solution-focused dialogue explaining the benefit or process. Natural ${industry} terminology."
    }
  ]
}

IMPORTANT: Return ONLY the JSON object, no other text or markdown formatting.`;
    }

    // Build user message based on mode
    let userMessage: any;
    
    if (isTextOnlyMode) {
      // Text-only mode - no image
      userMessage = {
        role: 'user',
        content: number_of_scenes === 1
          ? `Create a compelling 8-second video prompt featuring ${avatar_name} working in ${industry} in ${city}. Imagine ${avatar_name} as a confident, professional expert in their field.`
          : `Create a ${number_of_scenes}-scene DIGITAL MARKETING video story about ${avatar_name} working in ${industry} in ${city}.

Marketing Story: "${story_idea}"

CRITICAL REQUIREMENTS:
1. Imagine ${avatar_name} as a confident, professional ${industry} expert with polished business attire
2. Create ${number_of_scenes} prompts (${number_of_scenes * 8} seconds total) that form ONE SEAMLESS VIDEO
3. Each scene must include:
   - Consistent avatar appearance (describe the same professional look every time)
   - Explicit transition instructions (how scene begins from previous + how it ends for next)
   - Smooth motion and camera continuity
   - Natural story progression
   - PERSUASIVE DIALOGUE: 1-3 sentence script that ${avatar_name} speaks (problem → solution → CTA structure)

The final video should play like a single, professionally edited marketing video with compelling narration—not ${number_of_scenes} separate clips.`
      };
    } else {
      // Image mode - include image in vision request
      userMessage = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: number_of_scenes === 1
              ? `Based on this image, create a compelling 8-second video prompt featuring ${avatar_name} working in ${industry} in ${city}.`
              : `Based on this image, create a ${number_of_scenes}-scene DIGITAL MARKETING video story about ${avatar_name} working in ${industry} in ${city}.

Marketing Story: "${story_idea}"

CRITICAL REQUIREMENTS:
1. Note ${avatar_name}'s professional appearance and attire from the image for visual consistency
2. Create ${number_of_scenes} prompts (${number_of_scenes * 8} seconds total) that form ONE SEAMLESS VIDEO
3. Each scene must include:
   - Identical avatar appearance (reference physical description every time)
   - Explicit transition instructions (how scene begins from previous + how it ends for next)
   - Smooth motion and camera continuity
   - Natural story progression
   - PERSUASIVE DIALOGUE: 1-3 sentence script that ${avatar_name} speaks (problem → solution → CTA structure)

The final video should play like a single, professionally edited marketing video with compelling narration—not ${number_of_scenes} separate clips.`
          },
          {
            type: 'image_url',
            image_url: {
              url: image_url
            }
          }
        ]
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          userMessage
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('🎬 Generated response:', generatedText);

    // Check if OpenAI refused to analyze the image
    if (generatedText.includes("I'm sorry") || 
        generatedText.includes("can't assist") || 
        generatedText.includes("cannot assist") ||
        generatedText.includes("I'm unable") ||
        generatedText.includes("I cannot")) {
      console.error('⚠️ OpenAI content policy triggered. Response:', generatedText);
      throw new Error("Unable to analyze this image. Please try a different image or simplify your marketing story.");
    }

    // Parse response based on number of scenes
    if (number_of_scenes === 1) {
      // Single scene - return as-is
      return new Response(JSON.stringify({
        success: true,
        prompt: generatedText
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Multi-scene - parse JSON
      try {
        // Try to extract JSON if wrapped in markdown
        let jsonText = generatedText.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const parsed = JSON.parse(jsonText);
        
        if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
          throw new Error('Invalid response format: missing scenes array');
        }

        if (parsed.scenes.length !== number_of_scenes) {
          console.warn(`⚠️ Expected ${number_of_scenes} scenes, got ${parsed.scenes.length}`);
        }

        return new Response(JSON.stringify({
          success: true,
          scenes: parsed.scenes
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (parseError) {
        console.error('❌ Failed to parse multi-scene response:', parseError);
        console.error('Raw response:', generatedText);
        throw new Error('Failed to parse AI response. Please try again.');
      }
    }

  } catch (error) {
    console.error('❌ Error in analyze-image-kie:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Image analysis failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});