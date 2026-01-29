#!/usr/bin/env node
/**
 * Set KIE_AI_API_TOKEN in Vercel via REST API (no CLI auth).
 * Usage: node --env-file=.env scripts/set-kie-token-vercel-api.mjs
 * Env: KIE_AI_API_TOKEN, VERCEL_TOKEN, optional VERCEL_PROJECT_ID (or project name)
 */

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const KIE_TOKEN = process.env.KIE_AI_API_TOKEN || process.env.KIE_API_KEY;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME;

if (!KIE_TOKEN || KIE_TOKEN.length < 10) {
  console.error("Missing KIE_AI_API_TOKEN in .env");
  process.exit(1);
}

if (!VERCEL_TOKEN) {
  console.error("Missing VERCEL_TOKEN in .env (from Vercel → Settings → Tokens)");
  process.exit(1);
}

async function getProjectId() {
  if (PROJECT_ID) return PROJECT_ID;
  const res = await fetch("https://api.vercel.com/v9/projects", {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`List projects failed: ${res.status} ${t}`);
  }
  const data = await res.json();
  const projects = data.projects || [];
  if (projects.length === 0) throw new Error("No Vercel projects found");
  const name = projects[0].name;
  console.log("Using project:", name);
  return name;
}

async function addEnvVar(projectIdOrName) {
  const url = `https://api.vercel.com/v10/projects/${encodeURIComponent(projectIdOrName)}/env?upsert=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key: "KIE_AI_API_TOKEN",
      value: KIE_TOKEN,
      type: "encrypted",
      target: ["production", "preview"],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Create env failed: ${res.status} ${text}`);
  return text;
}

async function run() {
  const projectId = await getProjectId();
  await addEnvVar(projectId);
  console.log("KIE_AI_API_TOKEN set in Vercel (production + preview). Redeploy for the change to take effect.");
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
