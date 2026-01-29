# Fix Vercel CLI Token ("The specified token is not valid")

If `npm run redeploy:cli` fails with **"The specified token is not valid"**, use one of these approaches.

---

## Option 1: Create a new token (recommended)

1. **Open:** [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. **Create** a new token:
   - Click **Create**
   - **Name:** e.g. `CLI Deploy`
   - **Scope:** choose **Full Account** (required for deploy)
   - **Expiration:** No expiration (or set as needed)
3. **Copy** the token (it’s shown only once).
4. **Update `.env`:**
   ```bash
   VERCEL_TOKEN=paste_your_new_token_here
   ```
5. Run again:
   ```bash
   npm run redeploy:cli
   ```

**Note:** Tokens can expire after **10 days of inactivity**. If it stops working again, create another token and update `.env`.

---

## Option 2: Log in with the CLI (no token in .env)

This uses the browser and doesn’t rely on a dashboard token.

1. In your project directory, run:
   ```bash
   vercel login
   ```
2. Complete the flow in the browser (Vercel may show a code to enter).
3. Deploy:
   ```bash
   vercel --prod --yes
   ```
   No need to set `VERCEL_TOKEN` in `.env`; the CLI uses the credentials from `vercel login`.

---

## Option 3: Use the API redeploy (no CLI token)

The **API** token in your `.env` works for redeploys even when the CLI says the token is invalid. Use:

```bash
npm run redeploy:api
```

This calls the Vercel REST API and redeploys the latest production deployment. No CLI login or CLI token required.

---

## Summary

| Method              | Command / step                          | Token in .env?      |
|---------------------|------------------------------------------|----------------------|
| New dashboard token | Create at vercel.com/account/tokens     | Yes → `VERCEL_TOKEN` |
| CLI login           | `vercel login` then `vercel --prod --yes`| No                  |
| API redeploy        | `npm run redeploy:api`                   | Yes → `VERCEL_TOKEN` |

If the CLI keeps rejecting your token, use **Option 3** (`npm run redeploy:api`); it uses the same `VERCEL_TOKEN` and has been working in your setup.
