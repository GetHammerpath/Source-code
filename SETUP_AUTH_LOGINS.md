# Fix logins: Email, Google, Apple, GitHub

For people to get access via **Email/Password**, **Google**, **Apple**, and **GitHub**, configure the following in your **Supabase** project.

---

## 1. Redirect URLs (required for OAuth and email links)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add:
   - `https://YOUR_PRODUCTION_URL/dashboard` (e.g. `https://your-app.vercel.app/dashboard`)
   - `http://localhost:5173/dashboard` (for local dev)
4. **Site URL** should be your main app URL (e.g. `https://your-app.vercel.app`).

---

## 2. Email / Password

- Already supported by Supabase.
- If users don’t get in:
  - **Authentication** → **Providers** → **Email**: ensure “Enable Email Signup” (and “Confirm email” if you use it) match what you want.
  - Check **Authentication** → **Users** for failed attempts or “unconfirmed” users.

---

## 3. Google

1. **Authentication** → **Providers** → **Google** → turn **Enable Sign in with Google** ON.
2. In [Google Cloud Console](https://console.cloud.google.com/):
   - **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized redirect URIs**: add the exact URL Supabase shows (e.g. `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).
3. Copy **Client ID** and **Client Secret** into Supabase Google provider and **Save**.

---

## 4. Apple

1. **Authentication** → **Providers** → **Apple** → turn **Enable Sign in with Apple** ON.
2. In [Apple Developer](https://developer.apple.com/):
   - Create a **Services ID** and set the redirect URL Supabase gives you.
   - Create a **Key** for “Sign in with Apple”, get the **Key ID**, **Team ID**, **Services ID**, **Bundle ID**, and the **.p8** private key.
3. In Supabase Apple provider, fill in **Services ID**, **Secret Key** (contents of .p8), **Key ID**, **Team ID**, **Bundle ID** and **Save**.

(Apple requires a paid developer account and has extra steps; Supabase docs: [Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple).)

---

## 5. GitHub

1. **Authentication** → **Providers** → **GitHub** → turn **Enable Sign in with GitHub** ON.
2. In [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**:
   - **Authorization callback URL**: use the callback URL Supabase shows (e.g. `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).
3. Copy **Client ID** and generate a **Client Secret** from the GitHub app.
4. Paste both into Supabase GitHub provider and **Save**.

---

## 6. After OAuth: session on your app

When a user signs in with Google/Apple/GitHub, Supabase redirects to the URL you passed as `redirectTo` (in this app, `/dashboard`). The Supabase client will read the token from the URL hash and create a session. No extra code is needed if:

- Redirect URLs in Supabase include your real app URLs (step 1), and
- Your app uses the same Supabase project (same `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the frontend).

---

## Quick checklist

- [ ] Redirect URLs in Supabase include production and local `/dashboard` (and Site URL is set).
- [ ] Email provider settings match how you want signup/confirmation.
- [ ] Google: OAuth client created, redirect URI = Supabase callback, Client ID/Secret in Supabase.
- [ ] Apple: Services ID, key, and credentials configured in Supabase (if using Apple).
- [ ] GitHub: OAuth App callback = Supabase callback, Client ID/Secret in Supabase.

If a provider is not configured, its button may do nothing or show an error; once the steps above are done for that provider, that login method will work.
