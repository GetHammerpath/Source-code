import { createHash } from "crypto";

function json(res: any, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function handler(req: any, res: any) {
  // Public endpoint (no auth)
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
    // Vercel may provide already-parsed body; fall back to parsing if it's a string
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

  // Mock generator: return 4 deterministic avatar image URLs based on prompt.
  // IMPORTANT: Use a provider that doesn't trigger Kie "IP input image" rejections.
  // DiceBear provides deterministic, openly-generated avatars.
  const seed = createHash("sha256").update(prompt).digest("hex").slice(0, 12);
  const urls = Array.from({ length: 4 }, (_, i) => {
    const s = `${seed}-${i + 1}`;
    return `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(s)}&size=1024`;
  });

  json(res, 200, { urls });
}

