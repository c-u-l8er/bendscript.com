-- 001_schema.sql
-- Primary BendScript schema: workspaces, graph model, AI generations, and API keys.
-- Target: Supabase Postgres (auth.users present)

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
do $$
begin
  create type public.workspace_role as enum ('owner', 'admin', 'member', 'viewer');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.workspace_plan as enum ('free', 'kag_api', 'kag_teams', 'enterprise');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.node_type as enum ('normal', 'stargate');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.edge_kind as enum ('context', 'causal', 'temporal', 'associative', 'user');
exception
  when duplicate_object then null;
end
$$;

-- -----------------------------------------------------------------------------
-- Utility functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.generate_workspace_slug(base_text text)
returns text
language plpgsql
as $$
declare
  cleaned text;
begin
  cleaned := lower(regexp_replace(coalesce(base_text, ''), '[^a-zA-Z0-9]+', '-', 'g'));
  cleaned := regexp_replace(cleaned, '(^-+|-+$)', '', 'g');
  if cleaned = '' then
    cleaned := 'workspace';
  end if;
  return cleaned;
end;
$$;

-- -----------------------------------------------------------------------------
-- Core identity / tenancy
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  plan public.workspace_plan not null default 'free',
  stripe_customer_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (slug)
);

create index if not exists idx_workspaces_created_by on public.workspaces (created_by);

create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user_id on public.workspace_members (user_id);
create index if not exists idx_workspace_members_workspace_role on public.workspace_members (workspace_id, role);

create trigger trg_workspace_members_updated_at
before update on public.workspace_members
for each row
execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Graph model
-- -----------------------------------------------------------------------------
create table if not exists public.graphs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  is_archived boolean not null default false,
  is_public boolean not null default false,
  share_token text unique,
  created_by uuid references auth.users (id) on delete set null,
  root_plane_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, slug)
);

create index if not exists idx_graphs_workspace_id on public.graphs (workspace_id);
create index if not exists idx_graphs_public on public.graphs (is_public) where is_public = true;
create index if not exists idx_graphs_share_token on public.graphs (share_token) where share_token is not null;

create trigger trg_graphs_updated_at
before update on public.graphs
for each row
execute function public.set_updated_at();

create table if not exists public.graph_planes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  graph_id uuid not null references public.graphs (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  parent_plane_id uuid references public.graph_planes (id) on delete set null,
  parent_node_id uuid,
  is_root boolean not null default false,
  camera_x double precision not null default 0,
  camera_y double precision not null default 0,
  camera_zoom double precision not null default 1 check (camera_zoom > 0 and camera_zoom <= 4),
  tick bigint not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (graph_id, id)
);

create index if not exists idx_graph_planes_workspace_graph on public.graph_planes (workspace_id, graph_id);
create index if not exists idx_graph_planes_parent on public.graph_planes (parent_plane_id);

create trigger trg_graph_planes_updated_at
before update on public.graph_planes
for each row
execute function public.set_updated_at();

create table if not exists public.nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  graph_id uuid not null references public.graphs (id) on delete cascade,
  plane_id uuid not null references public.graph_planes (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 4000),
  markdown text,
  type public.node_type not null default 'normal',
  x double precision not null default 0,
  y double precision not null default 0,
  vx double precision not null default 0,
  vy double precision not null default 0,
  fx double precision not null default 0,
  fy double precision not null default 0,
  width integer,
  height integer,
  scroll_y integer not null default 0,
  pinned boolean not null default false,
  portal_plane_id uuid references public.graph_planes (id) on delete set null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (plane_id, id)
);

create index if not exists idx_nodes_workspace_graph_plane on public.nodes (workspace_id, graph_id, plane_id);
create index if not exists idx_nodes_type on public.nodes (type);
create index if not exists idx_nodes_portal_plane_id on public.nodes (portal_plane_id) where portal_plane_id is not null;
create index if not exists idx_nodes_text_fts on public.nodes using gin (to_tsvector('english', coalesce(text, '')));
create index if not exists idx_nodes_embedding_cosine on public.nodes using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create trigger trg_nodes_updated_at
before update on public.nodes
for each row
execute function public.set_updated_at();

create table if not exists public.edges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  graph_id uuid not null references public.graphs (id) on delete cascade,
  plane_id uuid not null references public.graph_planes (id) on delete cascade,
  node_a uuid not null references public.nodes (id) on delete cascade,
  node_b uuid not null references public.nodes (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 80),
  kind public.edge_kind not null default 'context',
  strength smallint not null default 1 check (strength between 1 and 5),
  flow_offset double precision not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (node_a <> node_b)
);

create index if not exists idx_edges_workspace_graph_plane on public.edges (workspace_id, graph_id, plane_id);
create index if not exists idx_edges_node_a on public.edges (node_a);
create index if not exists idx_edges_node_b on public.edges (node_b);
create index if not exists idx_edges_kind on public.edges (kind);

create trigger trg_edges_updated_at
before update on public.edges
for each row
execute function public.set_updated_at();

-- Ensure edge endpoints are in the same plane/workspace/graph as the edge row.
create or replace function public.validate_edge_integrity()
returns trigger
language plpgsql
as $$
declare
  a_row public.nodes%rowtype;
  b_row public.nodes%rowtype;
begin
  select * into a_row from public.nodes where id = new.node_a;
  if not found then
    raise exception 'edge node_a does not exist: %', new.node_a;
  end if;

  select * into b_row from public.nodes where id = new.node_b;
  if not found then
    raise exception 'edge node_b does not exist: %', new.node_b;
  end if;

  if a_row.workspace_id <> new.workspace_id
     or b_row.workspace_id <> new.workspace_id then
    raise exception 'edge workspace mismatch';
  end if;

  if a_row.graph_id <> new.graph_id
     or b_row.graph_id <> new.graph_id then
    raise exception 'edge graph mismatch';
  end if;

  if a_row.plane_id <> new.plane_id
     or b_row.plane_id <> new.plane_id then
    raise exception 'edge plane mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_edge_integrity on public.edges;
create trigger trg_validate_edge_integrity
before insert or update on public.edges
for each row
execute function public.validate_edge_integrity();

-- Root plane reference on graphs (added after graph_planes exists)
alter table public.graphs
  drop constraint if exists graphs_root_plane_id_fkey;

alter table public.graphs
  add constraint graphs_root_plane_id_fkey
  foreign key (root_plane_id) references public.graph_planes (id)
  on delete set null;

-- -----------------------------------------------------------------------------
-- AI generation logs
-- -----------------------------------------------------------------------------
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  graph_id uuid references public.graphs (id) on delete set null,
  plane_id uuid references public.graph_planes (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  prompt text not null,
  model text not null,
  tier smallint not null check (tier between 1 and 4),
  request_json jsonb not null default '{}'::jsonb,
  response_json jsonb not null default '{}'::jsonb,
  tokens_input integer not null default 0,
  tokens_output integer not null default 0,
  nodes_spawned integer not null default 0,
  edges_spawned integer not null default 0,
  latency_ms integer,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_ai_generations_workspace_created on public.ai_generations (workspace_id, created_at desc);
create index if not exists idx_ai_generations_user on public.ai_generations (user_id);

-- -----------------------------------------------------------------------------
-- API keys + usage
-- -----------------------------------------------------------------------------
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  key_prefix text not null check (char_length(key_prefix) between 8 and 20),
  key_hash text not null,
  scopes text[] not null default array['read']::text[],
  is_active boolean not null default true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (key_hash)
);

create index if not exists idx_api_keys_workspace_active on public.api_keys (workspace_id, is_active);
create index if not exists idx_api_keys_prefix on public.api_keys (key_prefix);

create trigger trg_api_keys_updated_at
before update on public.api_keys
for each row
execute function public.set_updated_at();

create table if not exists public.api_key_events (
  id bigserial primary key,
  api_key_id uuid references public.api_keys (id) on delete set null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  route text,
  method text,
  status_code integer,
  ip inet,
  user_agent text,
  request_id text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_api_key_events_workspace_created on public.api_key_events (workspace_id, created_at desc);
create index if not exists idx_api_key_events_key_created on public.api_key_events (api_key_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Public sharing
-- -----------------------------------------------------------------------------
create table if not exists public.shared_graph_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  graph_id uuid not null references public.graphs (id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  allow_download boolean not null default false,
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_shared_graph_links_graph on public.shared_graph_links (graph_id);
create index if not exists idx_shared_graph_links_active on public.shared_graph_links (is_active) where is_active = true;

-- -----------------------------------------------------------------------------
-- New user bootstrap: profile + personal workspace + owner membership
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  workspace_name text;
  workspace_slug_base text;
  workspace_slug text;
  ws_id uuid;
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = timezone('utc', now());

  workspace_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'My Workspace'
  );

  workspace_slug_base := public.generate_workspace_slug(workspace_name);
  workspace_slug := workspace_slug_base || '-' || right(replace(new.id::text, '-', ''), 6);

  insert into public.workspaces (name, slug, created_by, plan)
  values (workspace_name || ' Workspace', workspace_slug, new.id, 'free')
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (ws_id, new.id, 'owner', new.id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
