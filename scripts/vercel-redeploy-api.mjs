#!/usr/bin/env node
/**
 * Redeploy Vercel production via REST API (no CLI auth).
 * Usage: node --env-file=.env scripts/vercel-redeploy-api.mjs
 * Env: VERCEL_TOKEN, optional VERCEL_PROJECT_ID (default: source-code)
 */

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_NAME || "source-code";

if (!VERCEL_TOKEN) {
  console.error("Missing VERCEL_TOKEN in .env");
  process.exit(1);
}

async function getLatestDeployment() {
  const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(PROJECT)}&target=production&limit=1`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  });
  if (!res.ok) throw new Error(`List deployments failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const deployments = data.deployments || [];
  if (deployments.length === 0) throw new Error("No production deployment found. Deploy once from Vercel Dashboard or Git.");
  const d = deployments[0];
  return { id: d.uid, name: d.name };
}

async function redeploy(deploymentId, projectName) {
  const res = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: projectName,
      project: PROJECT,
      deploymentId,
      target: "production",
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Redeploy failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function run() {
  console.log("Fetching latest production deployment...");
  const { id, name } = await getLatestDeployment();
  console.log("Redeploying", name, "(" + id + ")...");
  const out = await redeploy(id, name);
  console.log("Redeploy triggered. Status:", out.status, "| ID:", out.id);
  console.log("Check: https://vercel.com/dashboard → Deployments");
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
