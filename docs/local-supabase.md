# Local Supabase Development Workflow (Recommended)

This project is designed for **Supabase in both dev and prod** for maximum behavior parity (Auth, RLS, SQL, Realtime, Edge Functions).

Use this workflow to run a full local stack while keeping production on hosted Supabase.

---

## Why this is the recommended setup

Using local Supabase in development gives you:

- Same Postgres + schema/migrations as prod
- Same Supabase Auth session model
- Same RLS policy behavior
- Same Realtime channels
- Same edge/runtime integration patterns

This avoids the drift you get with alternative local databases.

---

## Prerequisites

- Docker running
- Supabase CLI installed
- Node.js + npm installed

From project root:

- `bendscript.com/supabase/config.toml` is committed for local stack defaults

---

## 1) Start local Supabase

```sh
cd bendscript.com
npm run supabase:start
```

This starts local services (API, DB, Studio, Auth, Realtime, Inbucket, etc).

Useful helpers:

```sh
npm run supabase:status
npm run supabase:stop
```

---

## 2) Apply schema + RLS migrations locally

If this is a fresh local environment or you want a clean reset:

```sh
npm run supabase:db:reset
```

This applies migrations in `supabase/migrations` and recreates the local DB.

---

## 3) Configure app env for local Supabase

Create `.env.local` in `bendscript.com` with these values:

```env
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<local service role key from supabase status>

# Optional: force auth callback origin in local/dev to avoid cloud-domain redirects
PUBLIC_AUTH_REDIRECT_ORIGIN=http://localhost:5173

# Optional: show Google login button in local UI (disabled by default)
PUBLIC_BENDSCRIPT_GOOGLE_AUTH_ENABLED=false
```

Get local keys from:

```sh
npm run supabase:status
```

---

## 4) Run the app

```sh
npm run dev
```

Open:

- App: `http://127.0.0.1:5173`
- Supabase Studio: `http://127.0.0.1:54323`
- Inbucket (local email inbox): `http://127.0.0.1:54324`

---

## 5) Auth testing in local dev

Because local config has email confirmations disabled, email login should work quickly.

You can:

- Sign up/sign in from `/auth/login`
- Inspect users in Supabase Studio (`Authentication > Users`)
- Use Inbucket to inspect local magic-link emails if needed
- Google login is hidden by default in local UI unless `PUBLIC_BENDSCRIPT_GOOGLE_AUTH_ENABLED=true`
- Even with the button enabled, local Google OAuth also requires enabling `[auth.external.google]` in `supabase/config.toml` and providing valid Google OAuth credentials/callback setup

---

## 6) Production remains hosted Supabase

For prod/staging deployments, use hosted Supabase environment variables only.  
Do not point production to local URLs.

---

## Common commands

```sh
# Start local stack + app
npm run supabase:start
npm run dev

# Reset local DB and re-run migrations
npm run supabase:db:reset

# Inspect status/endpoints/keys
npm run supabase:status

# Stop local stack
npm run supabase:stop
```

---

## Troubleshooting

### `Missing required environment variable: PUBLIC_SUPABASE_URL`
Make sure `.env.local` exists in `bendscript.com` and restart dev server.

### Auth redirects to wrong host/port
Ensure app is running on `localhost:5173` (preferred) or `127.0.0.1:5173` to match `supabase/config.toml` auth URLs.

### Docker port conflicts
If ports `54321-54326` are in use, stop conflicting services or update `supabase/config.toml`.

### RLS behavior differs from expectations
Reset local DB and re-apply migrations:

```sh
npm run supabase:db:reset
```

---

## Team recommendation

For team consistency:

1. Keep schema/RLS changes in `supabase/migrations`
2. Test new auth/rls features against local Supabase before merge
3. Keep local callback URLs aligned with `supabase/config.toml` and `.env.local`