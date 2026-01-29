#!/usr/bin/env node
/**
 * Set KIE_AI_API_TOKEN in Vercel environment variables.
 *
 * Usage:
 *   node --env-file=.env scripts/set-vercel-kie-token.mjs
 *   KIE_AI_API_TOKEN=your_key node scripts/set-vercel-kie-token.mjs
 *
 * Requires: Vercel CLI (npm i -g vercel) and the project linked (vercel link).
 * The token is read from KIE_AI_API_TOKEN in the environment.
 */

import { spawn } from "child_process";

const token = process.env.KIE_AI_API_TOKEN || process.env.KIE_API_KEY;

if (!token || token.length < 10) {
  console.error("Missing KIE_AI_API_TOKEN (or KIE_API_KEY) in environment.");
  console.error("");
  console.error("Options:");
  console.error("  1. Run with env file:  node --env-file=.env scripts/set-vercel-kie-token.mjs");
  console.error("     (Add KIE_AI_API_TOKEN=your_key to .env)");
  console.error("  2. Run inline:         KIE_AI_API_TOKEN=your_key node scripts/set-vercel-kie-token.mjs");
  console.error("  3. Set in Vercel Dashboard: Settings → Environment Variables → Add KIE_AI_API_TOKEN");
  console.error("");
  process.exit(1);
}

console.log("Adding KIE_AI_API_TOKEN to Vercel (production)...");
const child = spawn("vercel", ["env", "add", "KIE_AI_API_TOKEN", "production"], {
  stdio: ["pipe", "inherit", "inherit"],
});
child.stdin.write(token + "\n");
child.stdin.end();

child.on("close", (code) => {
  if (code === 0) {
    console.log("Done. Redeploy the app (e.g. push to main or run: vercel --prod) for the change to take effect.");
  } else {
    console.error("If the command failed, set the variable in Vercel Dashboard:");
    console.error("  https://vercel.com → Your Project → Settings → Environment Variables");
    console.error("  Add: Name = KIE_AI_API_TOKEN, Value = <your Kie.ai API key>");
  }
  process.exit(code ?? 0);
});
