-- 002_rls.sql
-- Row Level Security policies for BendScript multi-tenant access

begin;

-- -------------------------------------------------------------------
-- Helper functions (workspace membership + role checks)
-- -------------------------------------------------------------------

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

-- -------------------------------------------------------------------
-- Enable RLS
-- -------------------------------------------------------------------

alter table if exists public.workspaces enable row level security;
alter table if exists public.workspace_members enable row level security;
alter table if exists public.graphs enable row level security;
alter table if exists public.graph_planes enable row level security;
alter table if exists public.nodes enable row level security;
alter table if exists public.edges enable row level security;
alter table if exists public.ai_generations enable row level security;
alter table if exists public.api_keys enable row level security;

-- -------------------------------------------------------------------
-- workspaces
-- -------------------------------------------------------------------

drop policy if exists "workspaces_select_member" on public.workspaces;
create policy "workspaces_select_member"
on public.workspaces
for select
using (public.is_workspace_member(id));

drop policy if exists "workspaces_insert_authenticated" on public.workspaces;
create policy "workspaces_insert_authenticated"
on public.workspaces
for insert
with check (auth.uid() is not null);

drop policy if exists "workspaces_update_admin" on public.workspaces;
create policy "workspaces_update_admin"
on public.workspaces
for update
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

drop policy if exists "workspaces_delete_owner_admin" on public.workspaces;
create policy "workspaces_delete_owner_admin"
on public.workspaces
for delete
using (public.is_workspace_admin(id));

-- -------------------------------------------------------------------
-- workspace_members
-- -------------------------------------------------------------------

drop policy if exists "workspace_members_select_member" on public.workspace_members;
create policy "workspace_members_select_member"
on public.workspace_members
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace_members_insert_admin" on public.workspace_members;
create policy "workspace_members_insert_admin"
on public.workspace_members
for insert
with check (
  public.is_workspace_admin(workspace_id)
  or (
    auth.uid() = user_id
    and not exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
    )
  )
);

drop policy if exists "workspace_members_update_admin" on public.workspace_members;
create policy "workspace_members_update_admin"
on public.workspace_members
for update
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "workspace_members_delete_admin_or_self" on public.workspace_members;
create policy "workspace_members_delete_admin_or_self"
on public.workspace_members
for delete
using (
  public.is_workspace_admin(workspace_id)
  or auth.uid() = user_id
);

-- -------------------------------------------------------------------
-- graphs
-- -------------------------------------------------------------------

drop policy if exists "graphs_select_member" on public.graphs;
create policy "graphs_select_member"
on public.graphs
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "graphs_insert_writer" on public.graphs;
create policy "graphs_insert_writer"
on public.graphs
for insert
with check (public.can_write_workspace(workspace_id));

drop policy if exists "graphs_update_writer" on public.graphs;
create policy "graphs_update_writer"
on public.graphs
for update
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "graphs_delete_admin" on public.graphs;
create policy "graphs_delete_admin"
on public.graphs
for delete
using (public.is_workspace_admin(workspace_id));

-- -------------------------------------------------------------------
-- graph_planes
-- -------------------------------------------------------------------

drop policy if exists "graph_planes_select_member" on public.graph_planes;
create policy "graph_planes_select_member"
on public.graph_planes
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "graph_planes_insert_writer" on public.graph_planes;
create policy "graph_planes_insert_writer"
on public.graph_planes
for insert
with check (public.can_write_workspace(workspace_id));

drop policy if exists "graph_planes_update_writer" on public.graph_planes;
create policy "graph_planes_update_writer"
on public.graph_planes
for update
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "graph_planes_delete_admin" on public.graph_planes;
create policy "graph_planes_delete_admin"
on public.graph_planes
for delete
using (public.is_workspace_admin(workspace_id));

-- -------------------------------------------------------------------
-- nodes
-- -------------------------------------------------------------------

drop policy if exists "nodes_select_member" on public.nodes;
create policy "nodes_select_member"
on public.nodes
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "nodes_insert_writer" on public.nodes;
create policy "nodes_insert_writer"
on public.nodes
for insert
with check (public.can_write_workspace(workspace_id));

drop policy if exists "nodes_update_writer" on public.nodes;
create policy "nodes_update_writer"
on public.nodes
for update
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "nodes_delete_writer" on public.nodes;
create policy "nodes_delete_writer"
on public.nodes
for delete
using (public.can_write_workspace(workspace_id));

-- -------------------------------------------------------------------
-- edges
-- -------------------------------------------------------------------

drop policy if exists "edges_select_member" on public.edges;
create policy "edges_select_member"
on public.edges
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "edges_insert_writer" on public.edges;
create policy "edges_insert_writer"
on public.edges
for insert
with check (public.can_write_workspace(workspace_id));

drop policy if exists "edges_update_writer" on public.edges;
create policy "edges_update_writer"
on public.edges
for update
using (public.can_write_workspace(workspace_id))
with check (public.can_write_workspace(workspace_id));

drop policy if exists "edges_delete_writer" on public.edges;
create policy "edges_delete_writer"
on public.edges
for delete
using (public.can_write_workspace(workspace_id));

-- -------------------------------------------------------------------
-- ai_generations
-- -------------------------------------------------------------------

drop policy if exists "ai_generations_select_member" on public.ai_generations;
create policy "ai_generations_select_member"
on public.ai_generations
for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "ai_generations_insert_writer" on public.ai_generations;
create policy "ai_generations_insert_writer"
on public.ai_generations
for insert
with check (
  public.can_write_workspace(workspace_id)
  and auth.uid() = user_id
);

drop policy if exists "ai_generations_update_admin" on public.ai_generations;
create policy "ai_generations_update_admin"
on public.ai_generations
for update
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "ai_generations_delete_admin" on public.ai_generations;
create policy "ai_generations_delete_admin"
on public.ai_generations
for delete
using (public.is_workspace_admin(workspace_id));

-- -------------------------------------------------------------------
-- api_keys
-- -------------------------------------------------------------------

drop policy if exists "api_keys_select_admin" on public.api_keys;
create policy "api_keys_select_admin"
on public.api_keys
for select
using (public.is_workspace_admin(workspace_id));

drop policy if exists "api_keys_insert_admin" on public.api_keys;
create policy "api_keys_insert_admin"
on public.api_keys
for insert
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "api_keys_update_admin" on public.api_keys;
create policy "api_keys_update_admin"
on public.api_keys
for update
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

drop policy if exists "api_keys_delete_admin" on public.api_keys;
create policy "api_keys_delete_admin"
on public.api_keys
for delete
using (public.is_workspace_admin(workspace_id));

commit;
