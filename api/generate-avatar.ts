import { createHash } from "crypto";

// Allow up to 60s for Kie Nano Banana Pro polling (Vercel Pro; hobby may still cap at 10s)
export const config = { maxDuration: 60 };

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

const KIE_BASE = "https://api.kie.ai/api/v1/jobs";

type KieCreateTaskResponse = {
  code?: number;
  msg?: string;
  data?: { taskId?: string };
};

type KieRecordInfoResponse = {
  code?: number;
  message?: string;
  data?: {
    state?: string;
    resultJson?: string;
    failMsg?: string;
  };
};

async function createNanoBananaProTask(
  token: string,
  prompt: string,
  variationIndex: number
): Promise<string | null> {
  // Use the prompt as-is (it should already be the full positive prompt from the builder)
  // Only add variation prefix if not the first one
  const finalPrompt = variationIndex === 0 
    ? prompt 
    : `${prompt}, variation ${variationIndex + 1}`;
  
  const res = await fetch(`${KIE_BASE}/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "nano-banana-pro",
      input: {
        prompt: finalPrompt,
        aspect_ratio: "1:1",
        resolution: "2K", // Use 2K for high-quality avatars (1K, 2K, or 4K available)
        output_format: "png",
        image_input: [], // Empty array for text-to-image (can add up to 8 images for image-to-image)
      },
    }),
  });
  
  const data = (await res.json().catch(() => ({}))) as KieCreateTaskResponse;
  if (!res.ok || data.code !== 200) {
    console.error(`[createNanoBananaProTask] Failed: ${res.status} - ${JSON.stringify(data)}`);
    return null;
  }
  return data.data?.taskId ?? null;
}

async function pollTaskResult(
  token: string,
  taskId: string,
  maxAttempts = 20,
  intervalMs = 3000
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${KIE_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json().catch(() => ({}))) as KieRecordInfoResponse;
    const state = data.data?.state;
    if (state === "success" && data.data?.resultJson) {
      try {
        const parsed = JSON.parse(data.data.resultJson) as { resultUrls?: string[] };
        const url = Array.isArray(parsed.resultUrls) ? parsed.resultUrls[0] : null;
        if (url) return url;
      } catch {
        // ignore parse error
      }
    }
    if (state === "fail") {
      return null;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

function fallbackDiceBear(prompt: string): string[] {
  const seed = createHash("sha256").update(prompt).digest("hex").slice(0, 12);
  return Array.from({ length: 4 }, (_, i) => {
    const s = `${seed}-${i + 1}`;
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(s)}&size=1024`;
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed. Use POST." });
    return;
  }

  let body: any = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    json(res, 400, { error: "Invalid JSON body" });
    return;
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    json(res, 400, { error: "Missing required field: prompt" });
    return;
  }

  const token = process.env.KIE_AI_API_TOKEN || process.env.KIE_API_KEY;
  if (token) {
    try {
      console.log(`[generate-avatar] Attempting Kie Nano Banana Pro with prompt: ${prompt.substring(0, 100)}...`);
      const taskIds: (string | null)[] = await Promise.all(
        [0, 1, 2, 3].map((i) => createNanoBananaProTask(token, prompt, i))
      );
      const validTaskIds = taskIds.filter((id): id is string => !!id);
      console.log(`[generate-avatar] Created ${validTaskIds.length}/4 tasks`);
      
      if (validTaskIds.length > 0) {
        const urls = await Promise.all(
          validTaskIds.map((id) => pollTaskResult(token, id))
        );
        const successUrls = urls.filter((u): u is string => !!u);
        console.log(`[generate-avatar] Got ${successUrls.length}/${validTaskIds.length} successful images`);
        
        if (successUrls.length >= 1) {
          // If we got at least one Kie image, pad with fallback so we always return 4
          const fallback = fallbackDiceBear(prompt);
          const result = [...successUrls];
          while (result.length < 4) result.push(fallback[result.length]);
          json(res, 200, {
            urls: result.slice(0, 4),
            model: "nano-banana-pro",
            engine: "Nano Banana Pro Engine",
            warning: successUrls.length < 4 ? `Only ${successUrls.length} photorealistic images generated; ${4 - successUrls.length} placeholder(s) added` : undefined,
          });
          return;
        }
      } else {
        console.error(`[generate-avatar] Failed to create any Kie tasks. Check API token and credits.`);
      }
    } catch (e) {
      console.error(`[generate-avatar] Kie API error:`, e);
      // fall through to DiceBear
    }
  } else {
    console.warn(`[generate-avatar] KIE_AI_API_TOKEN not set. Using placeholder avatars.`);
  }

  // Fallback to DiceBear (placeholder)
  const urls = fallbackDiceBear(prompt);
  json(res, 200, { 
    urls, 
    model: "nano-banana-pro", 
    engine: "Nano Banana Pro Engine",
    warning: "Using placeholder avatars. Set KIE_AI_API_TOKEN in Vercel environment variables for photorealistic generation.",
  });
}
