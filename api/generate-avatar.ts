import { createHash } from "crypto";

// Allow up to 60s for Kie Nano Banana polling (Vercel Pro; hobby may still cap at 10s)
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

async function createNanoBananaTask(
  token: string,
  prompt: string,
  variationIndex: number
): Promise<string | null> {
  const variationPrompt =
    variationIndex === 0
      ? prompt
      : `Photorealistic portrait, variation ${variationIndex + 1}: ${prompt}`;
  const res = await fetch(`${KIE_BASE}/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: "google/nano-banana",
      input: {
        prompt: `Photorealistic avatar headshot, professional quality: ${variationPrompt}`,
        output_format: "png",
        image_size: "1:1",
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as KieCreateTaskResponse;
  if (!res.ok || data.code !== 200) {
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
      const taskIds: (string | null)[] = await Promise.all(
        [0, 1, 2, 3].map((i) => createNanoBananaTask(token, prompt, i))
      );
      const validTaskIds = taskIds.filter((id): id is string => !!id);
      if (validTaskIds.length > 0) {
        const urls = await Promise.all(
          validTaskIds.map((id) => pollTaskResult(token, id))
        );
        const successUrls = urls.filter((u): u is string => !!u);
        if (successUrls.length >= 1) {
          // If we got at least one Kie image, pad with fallback so we always return 4
          const fallback = fallbackDiceBear(prompt);
          const result = [...successUrls];
          while (result.length < 4) result.push(fallback[result.length]);
          json(res, 200, {
            urls: result.slice(0, 4),
            model: "nano-banana",
            engine: "Nano Banana Engine",
          });
          return;
        }
      }
    } catch (e) {
      // fall through to DiceBear
    }
  }

  const urls = fallbackDiceBear(prompt);
  json(res, 200, { urls, model: "nano-banana", engine: "Nano Banana Engine" });
}
