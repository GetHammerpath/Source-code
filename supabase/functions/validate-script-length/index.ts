import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ~2.5 words/sec for natural spoken pace. Phase 1: relaxed limits (22/19) for less rushed delivery.
const WORDS_PER_SECOND = 2.5;
const FIRST_SEGMENT_SECONDS = 8;
const OTHER_SEGMENT_SECONDS = 7;
const FIRST_SEGMENT_MAX_WORDS = 22;  // was 20 - slightly relaxed for natural pacing
const OTHER_SEGMENT_MAX_WORDS = 19;  // was 17 - slightly relaxed for natural pacing

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const { script = '', segmentIndex = 0, trimIfOver = false } = body;

    const trimmedScript = String(script).trim();
    if (!trimmedScript) {
      return new Response(JSON.stringify({
        success: true,
        validatedScript: '',
        wordCount: 0,
        estimatedSeconds: 0,
        limitSeconds: segmentIndex === 0 ? FIRST_SEGMENT_SECONDS : OTHER_SEGMENT_SECONDS,
        maxWords: segmentIndex === 0 ? FIRST_SEGMENT_MAX_WORDS : OTHER_SEGMENT_MAX_WORDS,
        fitsLimit: true,
        wasTrimmed: false,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const wordCount = countWords(trimmedScript);
    const estimatedSeconds = wordCount / WORDS_PER_SECOND;
    const limitSeconds = segmentIndex === 0 ? FIRST_SEGMENT_SECONDS : OTHER_SEGMENT_SECONDS;
    const maxWords = segmentIndex === 0 ? FIRST_SEGMENT_MAX_WORDS : OTHER_SEGMENT_MAX_WORDS;
    const fitsLimit = wordCount <= maxWords;

    if (fitsLimit || !trimIfOver) {
      return new Response(JSON.stringify({
        success: true,
        validatedScript: trimmedScript,
        wordCount,
        estimatedSeconds: Math.round(estimatedSeconds * 10) / 10,
        limitSeconds,
        maxWords,
        fitsLimit,
        wasTrimmed: false,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Trim using ChatGPT if over limit
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({
        success: true,
        validatedScript: trimmedScript,
        wordCount,
        estimatedSeconds: Math.round(estimatedSeconds * 10) / 10,
        limitSeconds,
        maxWords,
        fitsLimit: false,
        wasTrimmed: false,
        error: 'AI trim unavailable: OpenAI not configured',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a video script editor. Trim scripts to fit exact word limits while keeping the message clear and natural. Output ONLY the trimmed script, no explanations. Preserve the tone and key message.`,
          },
          {
            role: 'user',
            content: `Trim this script to AT MOST ${maxWords} words (for ${limitSeconds}-second video). Keep it natural and impactful:\n\n"${trimmedScript}"`,
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI error:', res.status, errText);
      return new Response(JSON.stringify({
        success: true,
        validatedScript: trimmedScript,
        wordCount,
        estimatedSeconds: Math.round(estimatedSeconds * 10) / 10,
        limitSeconds,
        maxWords,
        fitsLimit: false,
        wasTrimmed: false,
        error: 'AI trim failed',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();
    let validatedScript = (data.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');
    const newWordCount = countWords(validatedScript);
    if (newWordCount > maxWords) {
      // Fallback: truncate by words
      validatedScript = validatedScript.split(/\s+/).slice(0, maxWords).join(' ');
    }

    return new Response(JSON.stringify({
      success: true,
      validatedScript: validatedScript || trimmedScript,
      wordCount: countWords(validatedScript || trimmedScript),
      estimatedSeconds: Math.round((countWords(validatedScript || trimmedScript) / WORDS_PER_SECOND) * 10) / 10,
      limitSeconds,
      maxWords,
      fitsLimit: countWords(validatedScript || trimmedScript) <= maxWords,
      wasTrimmed: true,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('validate-script-length error:', err);
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Validation failed',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
