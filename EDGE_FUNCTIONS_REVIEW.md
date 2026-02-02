# Edge Functions Review – Summary

**Date:** 2025-01-29 (updated 2026-01-29)

## Overview

All 49 edge functions were reviewed. The following changes were applied.

---

## Fixes Applied

### 1. `SERVICE_ROLE_KEY` fallback

Functions that only used `SUPABASE_SERVICE_ROLE_KEY` now also check `SERVICE_ROLE_KEY` (e.g. for Supabase projects that use the latter):

- `bulk-generate-videos`
- `smart-bulk-generate`
- `resume-bulk-batch`
- `retry-failed-generations`
- `kie-retry-generation`
- `retroactively-charge-credits`
- `stripe-webhook`
- `kie-generate-video`
- `kie-extend-video`
- `kie-extend-next`
- `cloudinary-stitch-batch`
- `runway-extend-next`
- `runway-extend-generate`
- `runway-extend-callback`
- `handle-n8n-callback`
- `sora2-callback`
- `admin-charge-credits`
- `analyze-image-kie`
- `sora2-extend-next`
- `kie-check-status`
- `fetch-provider-balances`
- `deduct-kie-credits`
- `sync-subscription`
- `sora-extend-next`
- `sora-callback`
- `admin-audit-log`
- `admin-invalidate-sessions`
- `admin-toggle-role`
- `admin-adjust-credits`
- `admin-force-password-reset`
- `admin-update-provider-settings`

### 2. `SUPABASE_URL` safety

Removed `!` non-null assertions and added `?? ''` fallbacks where `SUPABASE_URL` was used:

- `smart-bulk-generate` – was `Deno.env.get("SUPABASE_URL")!`
- `resume-bulk-batch` – was `Deno.env.get("SUPABASE_URL")!`
- `retry-failed-generations` – was `Deno.env.get("SUPABASE_URL")!`
- `runway-extend-callback`
- `runway-extend-next`
- `runway-extend-generate`
- `handle-n8n-callback`
- `bulk-generate-videos`
- All callback URLs in fetch/template strings now use `?? ''` (kie-callback, sora2-callback, kie-generate-video, kie-extend-video, kie-extend-next, kie-kling-generate-video, sora-generate-video, sora2-generate-video, sora-extend-next, sora2-extend-next, trigger-n8n-workflow)

### 3. `sora-generate-video` – Authorization header

- Replaced `req.headers.get('Authorization')!` with explicit null check and 401 response when missing

### 4. `video-generate` – Unused import

- Removed unused `createClient` import (router only forwards to other functions)

### 5. Admin charge credits – model-aware pricing

`admin-charge-credits` now charges based on the generation’s `model`:

- Fetches `model` from `kie_video_generations`
- Uses `creditsPerSegment` (e.g. veo3_fast = 1, veo3 = 3) consistent with `src/lib/video-models.ts`

---

## Functions Already OK (no changes)

| Function | Notes |
|----------|-------|
| `video-generate` | Phase 2 router; routing and env usage are correct |
| `kie-generate-video` | Auth, API key resolution, ownership checks OK |
| `kie-callback` | Service role fallback present; credit charging uses `video_jobs` |
| `cloudinary-stitch-videos` | Ownership check, dynamic `table_name`, SERVICE_ROLE fallback |
| `create-checkout-session` | Validates env and auth correctly |
| `stripe-webhook` | Signature verification and idempotency handled |
| `retroactively-charge-credits` | Model-aware credits via `creditsPerSegment` |
| `runway-extend-callback` | Passes `table_name` to cloudinary-stitch-videos |

---

## Config Notes

- **verify_jwt**: Callbacks (kie, sora, runway, stripe) have `verify_jwt = false` so webhooks work without a user JWT.
- **CORS**: All functions return suitable CORS headers for browser requests.

---

## Recommended Next Steps

1. Deploy the updated functions to Supabase.
2. Confirm Supabase secrets include `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY`.
3. Manually test critical flows: checkout, webhook, video generation, and admin charge credits.
