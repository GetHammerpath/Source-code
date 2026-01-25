#!/usr/bin/env node
/**
 * Trigger Vercel production deploy via Deploy Hook.
 * Usage: node --env-file=.env scripts/trigger-vercel-deploy.mjs
 * Env: VERCEL_DEPLOY_HOOK_URL (from Vercel → Project → Settings → Git → Deploy Hooks)
 */

const url = process.env.VERCEL_DEPLOY_HOOK_URL;
if (!url || !url.startsWith("https://")) {
  console.error("Missing VERCEL_DEPLOY_HOOK_URL in .env. Create a Deploy Hook in Vercel → Project → Settings → Git → Deploy Hooks.");
  process.exit(1);
}

async function run() {
  const res = await fetch(url, { method: "POST" });
  const text = await res.text();
  if (!res.ok) {
    console.error("Trigger failed:", res.status, text);
    process.exit(1);
  }
  console.log("Deploy triggered.", text || "Check Vercel Dashboard → Deployments.");
}

run().catch((e) => {
  console.error("Trigger failed:", e.message);
  process.exit(1);
});
