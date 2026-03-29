# Local Supabase Development Workflow

BendScript uses the **shared [&] ecosystem Supabase** at the repo root (`ProjectAmp2/ampersand-supabase/`). All ecosystem products share one Supabase instance with per-product PostgreSQL schemas.

BendScript tables live in the `kag.*` schema. Shared identity (profiles, workspaces, members) lives in `amp.*`.

---

## Prerequisites

- Docker running
- Supabase CLI installed
- Node.js + npm installed

Key files (at repo root):
- `ampersand-supabase/config.toml` — shared config for all ecosystem schemas
- `ampersand-supabase/migrations/010_kag_schema.sql` — BendScript schema
- `ampersand-supabase/migrations/011_kag_rls.sql` — BendScript RLS policies
- `ampersand-supabase/ARCHITECTURE.md` — full architecture spec

---

## 1) Start local Supabase

From the **repo root** (`ProjectAmp2/`):

```sh
supabase start
```

This starts the full ecosystem: all schemas (amp, kag, webhost, fleet, etc.), Auth, Realtime, Edge Functions, Studio.

Useful commands:

```sh
supabase status
supabase stop
```

---

## 2) Apply schema + RLS migrations locally

For a clean reset:

```sh
supabase db reset
```

This applies all migrations (000–081) and recreates the local DB with every ecosystem schema.

---

## 3) Configure app env for local Supabase

Create `.env.local` in `bendscript.com/` with these values:

```env
PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<local service role key from supabase status>

# Optional: force auth callback origin in local/dev
PUBLIC_AUTH_REDIRECT_ORIGIN=http://localhost:5173

# Optional: show Google login button
PUBLIC_BENDSCRIPT_GOOGLE_AUTH_ENABLED=false
```

Get local keys from:

```sh
supabase status
```

---

## 4) Run the app

```sh
cd bendscript.com
npm run dev
```

Open:

- App: `http://127.0.0.1:5173`
- Supabase Studio: `http://127.0.0.1:54323` (browse all schemas including `kag`)
- Inbucket (local email): `http://127.0.0.1:54324`

---

## 5) Querying kag.* tables

BendScript's Supabase client must target the `kag` schema:

```js
const { data } = await supabase.schema('kag').from('graphs').select('*')
```

Shared identity tables (profiles, workspaces) are in `amp`:

```js
const { data } = await supabase.schema('amp').from('profiles').select('*')
```

---

## 6) Auth testing in local dev

Local config has email confirmations disabled, so email login works immediately.

- Sign up/sign in from `/auth/login`
- Inspect users in Supabase Studio (`Authentication > Users`)
- The `amp.handle_new_user` trigger auto-creates profile + workspace on signup
- Google OAuth requires enabling `[auth.external.google]` in `ampersand-supabase/config.toml`

---

## Troubleshooting

### `Missing required environment variable: PUBLIC_SUPABASE_URL`
Make sure `.env.local` exists in `bendscript.com/` and restart dev server.

### Auth redirects to wrong host/port
Ensure app runs on `localhost:5173` to match `ampersand-supabase/config.toml` auth URLs.

### Docker port conflicts
If ports `54321-54326` are in use, stop conflicting services or update root `ampersand-supabase/config.toml`.

### RLS behavior differs from expectations
Reset the DB from repo root:

```sh
supabase db reset
```

---

## Team recommendation

1. All schema/RLS changes go in `ampersand-supabase/migrations/` at repo root (010-019 range for kag)
2. Test auth/RLS against local Supabase before merge
3. Keep local callback URLs aligned with `ampersand-supabase/config.toml` and `.env.local`
