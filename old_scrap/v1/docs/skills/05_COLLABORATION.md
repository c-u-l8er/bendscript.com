# Skill 05 — Collaboration

> **What this teaches:** How multi-tenant real-time collaboration works in
> BendScript — workspaces, membership, roles, real-time sync, conflict
> resolution, and the RLS security model.

---

## Workspaces

A workspace is the top-level organizational unit. All graph data (planes, nodes,
edges) belongs to a workspace. Every database row carries a `workspace_id`.

### Personal Workspace

On first sign-in, BendScript auto-creates a personal workspace for the user
with the `owner` role. This workspace is private by default.

### Team Workspaces

Users can create additional workspaces and invite members. Each workspace has
its own set of graphs, planes, and AI generation history.

---

## Workspace Membership

Members are tracked in the `workspace_members` table:

```
workspace_members
  ├── workspace_id
  ├── user_id
  └── role (owner | admin | member | viewer)
```

### Roles

| Role | Read | Create/Edit | Delete | Manage Members | Billing |
|------|------|-------------|--------|---------------|---------|
| viewer | yes | no | no | no | no |
| member | yes | yes | no | no | no |
| admin | yes | yes | yes | yes | no |
| owner | yes | yes | yes | yes | yes |

- Every workspace must have at least one `owner`.
- `admin` can invite/remove members and delete nodes/edges.
- `member` can create and edit but not delete or manage membership.
- `viewer` has read-only access — useful for sharing graphs externally.

---

## Real-Time Sync

BendScript uses Supabase Realtime broadcast channels for live collaboration.
When multiple users are on the same plane, changes propagate instantly.

### What Syncs in Real-Time

| Change | Sync Method |
|--------|------------|
| Node position (drag) | Broadcast — cursor position streamed to all clients |
| Node text edit | Broadcast — text changes streamed with debounce |
| Node creation/deletion | Database change + broadcast notification |
| Edge creation/deletion | Database change + broadcast notification |
| Plane navigation | Per-user state (not broadcast) |
| AI synthesis results | Database insert + broadcast notification |

### Channel Structure

Each workspace-plane combination gets a Realtime channel:

```
channel: workspace:{workspace_id}:plane:{plane_id}
```

Clients subscribe when entering a plane and unsubscribe when leaving.

---

## Conflict Resolution

When two users edit the same node simultaneously:

1. **Last-write-wins** for text content — the most recent Supabase upsert
   persists.
2. **Position averaging** for node drag — if two users drag the same node,
   positions are averaged on the next physics tick.
3. **No structural conflicts** — edge creation and node creation generate new
   rows, so they do not conflict.

For most knowledge graph editing, last-write-wins is sufficient because:

- Nodes are small (one idea per node).
- Edits are usually on different nodes.
- The physics engine smooths position disagreements.

---

## Sharing Graphs

### Public Read-Only Links

Workspace owners and admins can generate a public read-only link for a graph.
This link:

- Renders the graph in preview mode (no editing).
- Does not require sign-in.
- Shows the root plane with Stargate navigation.
- Supports SSR for SEO (shared graph previews render server-side).

### Embedding

Shared graphs can be embedded via iframe in external pages.

---

## RLS Security Model

Row-Level Security (RLS) in Postgres enforces tenant isolation at the database
layer. The application cannot bypass these rules — even if the SvelteKit server
has a bug, RLS prevents cross-tenant data access.

### Policy Structure

Every table with a `workspace_id` column has RLS policies:

```sql
-- SELECT: user must be a workspace member
CREATE POLICY "workspace_read" ON nodes
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: user must have member, admin, or owner role
CREATE POLICY "workspace_write" ON nodes
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('member', 'admin', 'owner')
    )
  );

-- DELETE: user must have admin or owner role
CREATE POLICY "workspace_delete" ON nodes
  FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );
```

### Auth Flow

1. User signs in via Supabase Auth (email or Google OAuth).
2. Supabase issues a JWT with the user's `uid`.
3. Every database query includes the JWT.
4. Postgres RLS policies use `auth.uid()` to filter rows.

The API key never grants cross-workspace access. Even service-role access
respects workspace boundaries in the application layer.

---

## Best Practices

- **One workspace per project** — keep graphs organized by team or topic.
- **Use viewer role for stakeholders** — share progress without edit risk.
- **Name Stargates clearly** — in collaborative settings, descriptive names
  prevent navigation confusion.
- **Pin key nodes** — prevent collaborators from accidentally displacing
  anchor nodes during simultaneous editing.
