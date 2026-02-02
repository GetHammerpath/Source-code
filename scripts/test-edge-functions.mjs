#!/usr/bin/env node
/**
 * Test Supabase Edge Functions - connectivity and basic responses.
 * Expects: non-500 for most calls (401/400/422 = expected for invalid/missing auth).
 * Usage:
 *   node --env-file=.env scripts/test-edge-functions.mjs
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 * Optional: TEST_USER_EMAIL, TEST_USER_PASSWORD (for auth-required tests)
 * Optional: SUPABASE_SERVICE_ROLE_KEY (for service-role tests)
 */

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY");
  process.exit(1);
}

const results = [];

async function invoke(name, options = {}) {
  const { body = {}, useServiceRole = false } = options;
  const auth = useServiceRole && serviceKey ? serviceKey : anon;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${auth}`,
    apikey: anon,
  };
  try {
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text?.slice(0, 200) };
    }
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function test(name, fn) {
  try {
    const result = await fn();
    // Pass: 2xx, or 4xx (validation/auth). 500 = fail (unexpected server error)
    const pass = result.ok || (result.status >= 400 && result.status < 500);
    results.push({
      name,
      pass,
      status: result.status,
      message: result.error || result.data?.error || (pass ? "OK" : `Status ${result.status}`),
    });
    return pass;
  } catch (e) {
    results.push({ name, pass: false, status: 0, message: e.message });
    return false;
  }
}

async function main() {
  console.log("Testing Edge Functions at", url.replace(/https?:\/\//, "").split("/")[0]);
  console.log("");

  // 1. video-generate (router) - invalid payload → expect 400/422
  await test("video-generate (router)", async () => {
    const r = await invoke("video-generate", {
      body: { model: "veo3_fast" },
      useServiceRole: true,
    });
    if (r.status === 401 && !serviceKey) return { ok: true, status: 401 };
    return r;
  });

  // 2. analyze-image-kie - minimal payload → expect 400/422 or 500 if missing OPENAI key
  await test("analyze-image-kie", async () => {
    const r = await invoke("analyze-image-kie", {
      body: {
        avatar_name: "Test",
        industry: "tech",
        city: "NYC",
        story_idea: "Test story",
        number_of_scenes: 1,
      },
      useServiceRole: true,
    });
    return r;
  });

  // 3. kie-check-status - missing generation_id → expect 400/422
  await test("kie-check-status", async () => {
    const r = await invoke("kie-check-status", {
      body: {},
      useServiceRole: true,
    });
    return r;
  });

  // 4. validate-script-length - simple payload
  await test("validate-script-length", async () => {
    const r = await invoke("validate-script-length", {
      body: { script: "Hello world.", maxWords: 20 },
      useServiceRole: true,
    });
    return r;
  });

  // 5. create-checkout-session - needs auth; without auth → 401
  await test("create-checkout-session", async () => {
    const r = await invoke("create-checkout-session", {
      body: { mode: "subscription", planId: "studio_access" },
    });
    if (r.status === 401) return { ok: true, status: 401 };
    return r;
  });

  // 6. api-keys - list keys needs auth → 401 without session
  await test("api-keys (list)", async () => {
    const r = await invoke("api-keys", {
      body: { action: "list" },
    });
    if (r.status === 401) return { ok: true, status: 401 };
    return r;
  });

  // 7. fetch-provider-balances - admin, needs service role
  await test("fetch-provider-balances", async () => {
    const r = await invoke("fetch-provider-balances", {
      useServiceRole: true,
    });
    if (r.status === 401 && !serviceKey) return { ok: true, status: 401 };
    return r;
  });

  // 8. sync-subscription - needs auth
  await test("sync-subscription", async () => {
    const r = await invoke("sync-subscription", {});
    if (r.status === 401) return { ok: true, status: 401 };
    return r;
  });

  // 9. admin-adjust-credits - admin, invalid payload → 400/401
  await test("admin-adjust-credits", async () => {
    const r = await invoke("admin-adjust-credits", {
      body: {},
      useServiceRole: true,
    });
    return r;
  });

  // 10. kie-extend-next - missing generation_id → 400
  await test("kie-extend-next", async () => {
    const r = await invoke("kie-extend-next", {
      body: {},
      useServiceRole: true,
    });
    return r;
  });

  // 11. cloudinary-stitch-videos - invalid payload → 400/422
  await test("cloudinary-stitch-videos", async () => {
    const r = await invoke("cloudinary-stitch-videos", {
      body: {},
      useServiceRole: true,
    });
    return r;
  });

  // 12. sora2-extend-next - missing generation_id → 400
  await test("sora2-extend-next", async () => {
    const r = await invoke("sora2-extend-next", {
      body: {},
      useServiceRole: true,
    });
    if (r.status === 400 || r.status === 404) return r;
    return r;
  });

  // 13. sora-extend-next - missing generation_id → 400
  await test("sora-extend-next", async () => {
    const r = await invoke("sora-extend-next", {
      body: {},
      useServiceRole: true,
    });
    if (r.status === 400 || r.status === 404) return r;
    return r;
  });

  // 14. resume-bulk-batch - missing batch_id → 400
  await test("resume-bulk-batch", async () => {
    const r = await invoke("resume-bulk-batch", {
      body: {},
      useServiceRole: true,
    });
    if (r.status === 400) return r;
    return r;
  });

  // 15. create-checkout-session GET - health check
  await test("create-checkout-session (GET health)", async () => {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    };
    const res = await fetch(`${url}/functions/v1/create-checkout-session`, {
      method: "GET",
      headers,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text?.slice(0, 200) };
    }
    return { ok: res.ok, status: res.status, data: json };
  });

  // Summary
  console.log("");
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    const icon = r.pass ? "✓" : "✗";
    const statusStr = r.status ? ` (${r.status})` : "";
    console.log(`  ${icon} ${r.name}${statusStr}: ${r.message}`);
  }
  console.log("");
  console.log(`Result: ${passed}/${results.length} passed`);

  if (failed.length) {
    console.log("");
    console.log("Failed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
