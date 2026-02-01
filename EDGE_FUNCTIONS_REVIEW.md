# Edge Functions Review

**Review date:** February 2026  
**Total functions:** 46

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Admin | 7 | ✅ All verify admin role, use service role for DB |
| Video (KIE) | 6 | ✅ Proper auth, callbacks verify_jwt=false |
| Video (Sora/Sora2) | 6 | ✅ Consistent patterns |
| Video (Runway) | 4 | ✅ |
| Bulk / Batch | 4 | ✅ Ownership checks added for retry/resume |
| Cloudinary | 2 | ✅ Stitch batch verifies ownership |
| Stripe / Billing | 4 | ✅ Webhook verifies signature |
| Other | 13 | ✅ |

---

## Fixes Applied

### 1. `create-checkout-session` – Service key env
- **Issue:** Used `SERVICE_ROLE_KEY` while Supabase provides `SUPABASE_SERVICE_ROLE_KEY`
- **Fix:** Accept both; prefer `SUPABASE_SERVICE_ROLE_KEY`

### 2. `retry-failed-generations` – Ownership
- **Issue:** No check that the JWT user owns the batch
- **Fix:** Ownership check added; 403 if batch belongs to another user

### 3. `resume-bulk-batch` – Ownership
- **Issue:** No ownership check
- **Fix:** Same ownership check added

### 4. `config.toml` – Missing entries
- **Fix:** Explicit entries for `retry-failed-generations` and `resume-bulk-batch` with `verify_jwt = true`

---

## Auth & Security

### verify_jwt = false (callbacks / webhooks)
- `kie-callback`, `sora-callback`, `sora2-callback`, `runway-extend-callback` – External callbacks
- `handle-n8n-callback` – n8n webhook
- `stripe-webhook` – Stripe webhook (signature verified separately)
- `analyze-image-kie`, `analyze-image-for-request` – Called by other Edge Functions with service key
- `cloudinary-stitch-videos` – Called by kie-callback
- `create-checkout-session` – Manual auth in handler; JWT may be sent by client

### verify_jwt = true (user-facing)
- Admin, video generation, bulk, billing – Require valid JWT

---

## Patterns Observed

### Strong
- CORS headers on all functions
- OPTIONS preflight handled
- Error handling with JSON responses
- Admin functions check `user_roles.role === 'admin'`
- Callbacks use service role for DB
- stripe-webhook verifies `stripe-signature` before processing

### Minor / Suggestions
1. **admin-audit-log** – Uses 400 for server errors; 500 might be more appropriate for DB errors
2. **admin-force-password-reset** – Uses `resetPasswordForEmail`; correct for sending reset link
3. **Supabase client versions** – Mix of `@2`, `@2.38.4`; consider standardizing to `@2`

---

## Config Coverage

All deployed functions have config entries where needed. Unlisted functions use Supabase defaults (`verify_jwt = true`).

---

## Deployment

All 46 functions deploy successfully. To redeploy:

```bash
npx supabase functions deploy
```
