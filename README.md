# TaskFlow — shared team task board

One board your whole team logs into. Everyone sees open work, claims tasks, completes
them, and managers approve + track who did what. Built as a static site (HTML + React via
CDN) backed by **Supabase** for real accounts and shared data.

- **Email + password** auth, logout
- **Admin invites by email** (manager creates an invite link; teammate sets their own password)
- **Manager / Member** roles — first signup becomes the Manager
- One shared workspace, starts empty
- Runs in **demo mode** (this browser only) until you connect Supabase

---

## How it works

The app talks only to `backend.js`, which has two modes:

| Mode | When | Data lives | Shared? |
|------|------|-----------|---------|
| **Demo** | `config.js` is blank | this browser (localStorage) | No |
| **Live** | `config.js` has your Supabase URL + anon key | Supabase Postgres | Yes ✅ |

Open `index.html` right now and it works in demo mode — try the manager account
`maya@brightside.studio` / `taskflow`, or create one. To go live, do the 3 steps below.

---

## Go live (≈ 10 minutes)

### 1. Create the Supabase backend
1. Sign up at **supabase.com** → **New project** (free tier is fine). Pick a strong DB password.
2. When it's ready, open **SQL Editor → New query**, paste the entire contents of
   [`schema.sql`](./schema.sql), and click **Run**. This creates the tables, security
   rules, and the trigger that makes the first signup a Manager.
3. *(Optional, recommended while testing)* **Authentication → Providers → Email** → turn
   **off "Confirm email"** so new accounts work instantly. Leave it on for production and
   teammates will confirm via email before their first login.

### 2. Add your keys
1. In Supabase: **Project Settings → API**. Copy **Project URL** and the **anon / public** key.
2. Paste them into [`config.js`](./config.js):
   ```js
   window.TASKFLOW_CONFIG = {
     SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGci...your anon key...",
   };
   ```
   > The anon/public key is **safe** in front-end code (that's what it's for).
   > **Never** put the `service_role` key here.

### 3. Deploy with GitHub + Netlify
1. Push this folder to a new **GitHub** repo.
2. In **Netlify**: **Add new site → Import an existing project → GitHub** → pick the repo.
3. Build settings: **no build command**, **publish directory = `.`** (root). `netlify.toml`
   already sets this. Click **Deploy**.
4. Open your Netlify URL. The **first person to sign up is the Manager** — that's you.

In Supabase, add your Netlify URL under **Authentication → URL Configuration → Site URL**
(and Redirect URLs) so confirmation/links resolve correctly.

---

## Inviting your team
Log in as the manager → **Invite** (top bar) → enter a teammate's email + role → **Create
invite**. Copy the link (or hit **Email it**) and send it. They open it, set a password, and
they're in — as the role you picked. Pending invites are listed in the same panel.

---

## Roles
- **Manager** — everything a member can do, plus: approve / send back submitted work, invite
  teammates, and the Team & activity overview badges.
- **Member** — see the board, claim tasks, complete them, comment.

The first account is a Manager. Promote others by inviting them as Manager, or change `role`
in the `profiles` table in Supabase.

---

## Files
| File | What it is |
|------|-----------|
| `index.html` | the app entry (Netlify serves this) |
| `config.js` | **your Supabase keys go here** |
| `backend.js` | data layer — Supabase + demo-mode |
| `schema.sql` | run once in Supabase to create the database |
| `app.jsx` | app shell, routing, state |
| `auth.jsx` | login / signup / accept-invite / invite / profile |
| `views.jsx`, `panels.jsx`, `ui.jsx` | board, task detail, modals, components |
| `tweaks-panel.jsx` | live theme/copy tweak panel |
| `data.js` | demo seed + constants (departments, priorities) |
| `netlify.toml` | Netlify config (publish root) |
| `TaskFlow.html` | same app, kept for in-editor preview |

---

## Notes & limits
- It's a **single shared workspace**. Multi-team/department support can be layered on later.
- Task updates (claim/complete) are open to any signed-in teammate by design (a shared board).
  Approvals are gated to managers in the UI; tighten the `tasks_update` policy in `schema.sql`
  if you want server-enforced restrictions.
- Automated invite *emails* (vs. sharing the link) need a small serverless function with the
  Supabase service_role key — easy to add as a Netlify Function later. The link-sharing flow
  here needs no secrets and works out of the box.
