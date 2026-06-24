# Email features setup (optional)

TaskFlow works fully without these. Turn them on when you want **invites emailed
automatically** (instead of copy-the-link) and **daily due/overdue reminders**.

Both run as **Netlify Functions** (already in `netlify/functions/`). They need an email
provider and a few environment variables. The app detects whether `send-invite` is
available and silently falls back to the copy-link flow if it isn't — so nothing breaks
if you skip this.

## 1. Get an email provider (Resend — free tier)
1. Sign up at **resend.com**.
2. Add & verify a sending domain (or use their onboarding sandbox sender for testing).
3. Create an **API key** → copy it.

## 2. Add environment variables in Netlify
**Site settings → Environment variables** → add:

| Variable | Value | Used by |
|---|---|---|
| `RESEND_API_KEY` | your Resend key | both functions |
| `FROM_EMAIL` | e.g. `EQGenix <team@yourdomain.com>` (must be a verified sender) | both |
| `SITE_URL` | your deployed URL, e.g. `https://eqgtask.netlify.app` | reminders |
| `SUPABASE_URL` | your Supabase project URL | reminders |
| `SUPABASE_SERVICE_ROLE` | Supabase **service_role** key (Project Settings → API) | reminders |

> ⚠️ The **service_role** key is a full-access secret. It lives ONLY here in Netlify's
> server environment — never in `config.js` or any front-end file.

Redeploy after adding them (Netlify → Deploys → Trigger deploy).

## 3. What each function does
- **`send-invite`** — when a manager creates an invite, the app POSTs to it and it emails
  the invite link. No setup beyond `RESEND_API_KEY` + `FROM_EMAIL`. If it's missing, the
  invite panel just shows the copy/share link as before.
- **`daily-reminders`** — a **scheduled** function (cron in `netlify.toml`, weekdays 8am
  UTC) that emails each person a summary of their tasks due today or overdue. Change the
  `schedule` in `netlify.toml` (and the `export const config` in the function) to adjust.

## 4. Test
- **Invites:** log in as a manager → Invite → enter an email you control → you should get
  the email, and the panel will say "Emailed to … ✓".
- **Reminders:** Netlify → Functions → `daily-reminders` → **Run** to trigger it manually
  without waiting for the cron.

That's it. Skipping this file leaves TaskFlow fully functional with manual link-sharing.
