# Set KIE_AI_API_TOKEN in Vercel

The casting interface uses **Nano Banana Pro** for photorealistic avatars. Without `KIE_AI_API_TOKEN` in Vercel, the app falls back to placeholder (cartoon) avatars.

## Option 1: Vercel Dashboard (recommended)

1. Go to [Vercel Dashboard](https://vercel.com) and open your project.
2. Click **Settings** → **Environment Variables**.
3. Add a new variable:
   - **Name:** `KIE_AI_API_TOKEN`
   - **Value:** Your Kie.ai API key (same key you use for Supabase Edge Functions).
   - **Environments:** Check **Production** (and **Preview** if you want it on preview deployments).
4. Click **Save**.
5. **Redeploy** so the new variable is picked up:
   - **Deployments** → open the **⋯** on the latest deployment → **Redeploy**.

## Option 2: Vercel CLI (from repo)

From your project root, with your Kie.ai key in `.env`:

```bash
# Add KIE_AI_API_TOKEN=your_kie_key to .env, then:
npm run vercel:set-kie-token
```

Or pass the token inline (do not commit this):

```bash
KIE_AI_API_TOKEN=your_key node scripts/set-vercel-kie-token.mjs
```

You need the Vercel CLI and the project linked:

```bash
npm i -g vercel
vercel link
```

Then redeploy (e.g. push to `main` or run `vercel --prod`).

## Where to get the Kie.ai API key

1. Go to [Kie.ai API Key](https://kie.ai/api-key).
2. Sign in or create an account.
3. Copy your API key and use it as the value for `KIE_AI_API_TOKEN`.

## Verify

After redeploying, use the casting interface on the home page and click **Generate**. If the token is set correctly, you should see photorealistic avatars instead of cartoon placeholders. If you still see placeholders, check:

- Variable name is exactly `KIE_AI_API_TOKEN` (or `KIE_API_KEY`).
- You redeployed after adding the variable.
- Your Kie.ai account has credits.
