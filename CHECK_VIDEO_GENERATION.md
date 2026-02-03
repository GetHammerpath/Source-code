# Videos not generating – checklist

If videos stay on "Processing" or never start, work through this list.

## 1. Deploy Edge Functions (required)

Supabase Edge Functions **do not deploy from Git**. You must deploy them:

```bash
npx supabase login
cd /path/to/Source-code
npx supabase functions deploy --project-ref YOUR_PROJECT_REF
```

Get **YOUR_PROJECT_REF** from [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **General** → **Reference ID**.

Without this step, the live functions are old or missing and videos will not start.

---

## 2. Set Kie.ai API key in Supabase

1. Open **Supabase Dashboard** → your project → **Edge Functions** → **Secrets** (or **Project Settings** → **Edge Functions**).
2. Add secret: **`KIE_AI_API_TOKEN`** = your Kie.ai API key (from [kie.ai/api-key](https://kie.ai/api-key)).

If this is missing, `kie-generate-video` and Sora2 functions will fail with "KIE_AI_API_TOKEN not configured" or similar. The batch page will show that error on the failed video once we've saved it.

---

## 3. Check the batch page for errors

- Open the batch detail page (e.g. `/batch/<batch-id>`).
- For each **failed** video, the app now shows the **exact error** under the video (e.g. "Insufficient credits", "KIE_AI_API_TOKEN not configured", "Generation not found").
- Use that message to fix the cause (add credits, set token, fix config).

---

## 4. Check Edge Function logs

In **Supabase Dashboard** → **Edge Functions** → **Logs**, open:

- **bulk-generate-videos** – when the batch starts
- **video-generate** – when each video is submitted
- **kie-generate-video** or **sora2-generate-video** – when the request is sent to Kie
- **kie-callback** or **sora2-callback** – when Kie finishes a scene

Look for red errors or our `❌` log lines. That will show whether the failure is in your code, missing config, or Kie rejecting the request.

---

## 5. Quick test: single video from Studio

- Go to **Studio** (or the single-video generator).
- Create **one** video with **Veo 3.1 Fast** and a simple prompt.
- If that never starts or fails, the same checklist applies (deploy functions, set `KIE_AI_API_TOKEN`, then check logs).

---

## Summary

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| All videos stuck on loading | Edge Functions not deployed | Run `npx supabase functions deploy --project-ref YOUR_REF` |
| Error: "KIE_AI_API_TOKEN not configured" | Secret not set in Supabase | Add `KIE_AI_API_TOKEN` in Edge Function secrets |
| Error: "Insufficient credits" | Not enough Kie.ai credits | Add credits at kie.ai |
| Error: "Generation not found" | Callback or DB lookup issue | Check Edge Function logs for kie-callback / sora2-callback |

After deploying and setting the token, create a **new** batch or new video; old stuck rows may still show the previous error until you retry.
