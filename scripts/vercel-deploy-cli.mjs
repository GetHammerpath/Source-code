#!/usr/bin/env node
/**
 * Deploy to Vercel production via CLI using VERCEL_TOKEN.
 * Usage: node --env-file=.env scripts/vercel-deploy-cli.mjs
 * Env: VERCEL_TOKEN (from Vercel → Settings → Tokens)
 */

import { spawnSync } from "child_process";

const token = process.env.VERCEL_TOKEN;
if (!token || typeof token !== "string" || token.length < 10) {
  console.error("Missing or invalid VERCEL_TOKEN in .env. Create a token at Vercel → Settings → Tokens.");
  process.exit(1);
}

// Pass token via --token so CLI uses it; also set env for any subprocess
const result = spawnSync(
  "vercel",
  ["--prod", "--yes", "--token", token],
  {
    stdio: "inherit",
    env: { ...process.env, VERCEL_TOKEN: token },
    cwd: process.cwd(),
  }
);

process.exit(result.status ?? 1);
