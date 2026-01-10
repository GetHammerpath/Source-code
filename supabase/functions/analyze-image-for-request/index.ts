import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const N8N_ANALYSIS_WEBHOOK = "https://hammerpath.app.n8n.cloud/webhook/b4ae7ac3-8ce5-4a16-ae3b-348901d76420";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      image_url, 
      company_name, 
      company_type, 
      avatar_name, 
      city_community, 
      render_mode 
    } = await req.json();

    console.log('Analyzing image for request:', {
      company_name,
      company_type,
      avatar_name,
      city_community,
      render_mode
    });

    // Call n8n webhook with minimal data
    const response = await fetch(N8N_ANALYSIS_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url,
        company_name,
        company_type,
        avatar_name,
        city_community,
        render_mode
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('N8N webhook error:', response.status, errorText);
      throw new Error(`Webhook returned status ${response.status}: ${errorText}`);
    }

    // Parse the webhook response
    const rawResponse = await response.json();
    console.log('📥 Raw n8n response:', JSON.stringify(rawResponse, null, 2));

    // Extract data from n8n's nested format
    let aiGeneratedData;
    try {
      // Get first array element from outer response
      const firstItem = Array.isArray(rawResponse) ? rawResponse[0] : rawResponse;
      
      if (!firstItem || !firstItem.content) {
        throw new Error('Invalid webhook response format: missing content field');
      }
      
      let contentStr = firstItem.content;
      
      // Remove markdown code block markers if present (```json\n and \n```)
      contentStr = contentStr.replace(/^```json\s*\n?/g, '').replace(/\n?```$/g, '');
      
      // Parse the content string (it's JSON)
      let parsedContent;
      try {
        parsedContent = JSON.parse(contentStr);
        console.log('✅ Parsed content layer:', JSON.stringify(parsedContent, null, 2));
      } catch (directParseError) {
        // If direct parsing fails, try parsing after converting escaped newlines
        const unescapedContent = contentStr.replace(/\\n/g, '\n').replace(/\\"/g, '"');
        parsedContent = JSON.parse(unescapedContent);
        console.log('✅ Parsed content layer (after unescape):', JSON.stringify(parsedContent, null, 2));
      }
      
      // Check if parsedContent is an array with nested structure
      if (Array.isArray(parsedContent) && parsedContent[0]?.content) {
        // Double-nested format: [{ "content": {...actual data...} }]
        aiGeneratedData = parsedContent[0].content;
        console.log('✅ Extracted from double-nested format:', JSON.stringify(aiGeneratedData, null, 2));
      } else {
        // Single object format: {...actual data...}
        aiGeneratedData = parsedContent;
        console.log('✅ Using direct parsed data:', JSON.stringify(aiGeneratedData, null, 2));
      }
      
    } catch (parseError) {
      console.error('❌ Failed to parse n8n response:', parseError);
      console.error('Raw content:', rawResponse);
      throw new Error('Invalid JSON format in webhook response');
    }
    
    // Extract character name and details
    const characterName = (typeof aiGeneratedData.character === 'object' && aiGeneratedData.character?.Name) 
      ? aiGeneratedData.character.Name 
      : (aiGeneratedData.character || avatar_name);
    
    // Build enhanced story_idea with character details
    let enhancedStoryIdea = aiGeneratedData.story_idea || '';
    if (typeof aiGeneratedData.character === 'object' && aiGeneratedData.character) {
      const characterDetails = [];
      if (aiGeneratedData.character.Role) {
        characterDetails.push(`Role: ${aiGeneratedData.character.Role}`);
      }
      if (aiGeneratedData.character['Voice & Tone']) {
        characterDetails.push(`Voice & Tone: ${aiGeneratedData.character['Voice & Tone']}`);
      }
      if (aiGeneratedData.character['Visual Style']) {
        characterDetails.push(`Visual Style: ${aiGeneratedData.character['Visual Style']}`);
      }
      if (aiGeneratedData.character.Purpose) {
        characterDetails.push(`Purpose: ${aiGeneratedData.character.Purpose}`);
      }
      
      if (characterDetails.length > 0) {
        enhancedStoryIdea += enhancedStoryIdea ? '\n\n' : '';
        enhancedStoryIdea += `Character Details:\n${characterDetails.join('\n')}`;
      }
    }
    
    // Return enriched data
    return new Response(JSON.stringify({
      success: true,
      data: {
        // Original inputs
        client_company_name: company_name,
        company_type,
        city_community,
        render_mode,
        // AI-generated fields
        title: aiGeneratedData.title || '',
        caption: aiGeneratedData.caption || '',
        story_idea: enhancedStoryIdea,
        character: characterName,
        visual_style: (aiGeneratedData.visual_style || 'realistic').toLowerCase(),
        colors: aiGeneratedData.colors || '',
        gender_avatar: (aiGeneratedData.gender_avatar || 'neutral').toLowerCase(),
        aspect_ratio: aiGeneratedData.aspect_ratio || '16:9',
        scenes: aiGeneratedData.scenes || 5
      }
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in analyze-image-for-request:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze image'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
