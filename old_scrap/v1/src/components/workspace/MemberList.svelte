<script>
  /**
   * Workspace member list component
   *
   * Props:
   * - members: Array<{ userId, role, joinedAt, profile?: { full_name?, email?, avatar_url? } }>
   * - title: string
   * - showJoinedDate: boolean
   * - compact: boolean
   * - loading: boolean
   * - error: string
   */
  let {
    members = [],
    title = "Members",
    showJoinedDate = true,
    compact = false,
    loading = false,
    error = "",
  } = $props();

  const ROLE_ORDER = {
    owner: 0,
    admin: 1,
    member: 2,
    viewer: 3,
  };

  const normalizedMembers = $derived(
    Array.isArray(members)
      ? [...members].filter(Boolean).sort((a, b) => {
          const aRole = String(a?.role || "viewer").toLowerCase();
          const bRole = String(b?.role || "viewer").toLowerCase();

          const byRole = (ROLE_ORDER[aRole] ?? 99) - (ROLE_ORDER[bRole] ?? 99);
          if (byRole !== 0) return byRole;

          const aName = displayName(a).toLowerCase();
          const bName = displayName(b).toLowerCase();
          return aName.localeCompare(bName);
        })
      : [],
  );

  function displayName(member) {
    return (
      member?.profile?.full_name ||
      member?.profile?.email ||
      member?.userId ||
      "Unknown user"
    );
  }

  function roleLabel(role) {
    const value = String(role || "member").toLowerCase();
    if (value === "owner") return "Owner";
    if (value === "admin") return "Admin";
    if (value === "member") return "Member";
    if (value === "viewer") return "Viewer";
    return "Member";
  }

  function initials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!parts.length) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  function formatDate(input) {
    if (!input) return "—";
    const d = new Date(input);
    if (Number.isNaN(d.valueOf())) return "—";
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
</script>

<section class="member-list" data-compact={compact}>
  <header class="member-list__header">
    <h3>{title}</h3>
    <span class="member-list__count">{normalizedMembers.length}</span>
  </header>

  {#if loading}
    <div class="member-list__state">Loading members…</div>
  {:else if error}
    <div class="member-list__state member-list__state--error">{error}</div>
  {:else if normalizedMembers.length === 0}
    <div class="member-list__state">No members yet.</div>
  {:else}
    <ul class="member-list__items">
      {#each normalizedMembers as member (member.userId)}
        <li class="member-row">
          <div class="member-row__identity">
            {#if member?.profile?.avatar_url}
              <img
                class="avatar avatar--image"
                src={member.profile.avatar_url}
                alt={displayName(member)}
                loading="lazy"
              />
            {:else}
              <span class="avatar">{initials(displayName(member))}</span>
            {/if}

            <div class="member-row__meta">
              <strong title={displayName(member)}>{displayName(member)}</strong>
              {#if member?.profile?.email && member?.profile?.full_name}
                <small>{member.profile.email}</small>
              {/if}
            </div>
          </div>

          <div class="member-row__status">
            <span
              class="role role--{String(
                member?.role || 'member',
              ).toLowerCase()}"
            >
              {roleLabel(member?.role)}
            </span>
            {#if showJoinedDate}
              <small class="joined">Joined {formatDate(member?.joinedAt)}</small
              >
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .member-list {
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    background: #fff;
    padding: 0.95rem;
  }

  .member-list[data-compact="true"] {
    padding: 0.75rem;
  }

  .member-list__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    margin-bottom: 0.75rem;
  }

  .member-list__header h3 {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 700;
    color: #0f172a;
  }

  .member-list__count {
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    padding: 0.2rem 0.5rem;
    font:
      600 0.72rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    color: #334155;
    background: #f8fafc;
  }

  .member-list__state {
    border: 1px dashed #cbd5e1;
    border-radius: 0.75rem;
    padding: 0.75rem;
    color: #64748b;
    font-size: 0.88rem;
  }

  .member-list__state--error {
    border-color: #fecaca;
    color: #991b1b;
    background: #fef2f2;
  }

  .member-list__items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.55rem;
  }

  .member-row {
    border: 1px solid #e2e8f0;
    border-radius: 0.75rem;
    padding: 0.58rem 0.62rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    min-width: 0;
    background: #f8fafc;
  }

  .member-list[data-compact="true"] .member-row {
    padding: 0.5rem 0.55rem;
  }

  .member-row__identity {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
  }

  .member-row__meta {
    min-width: 0;
  }

  .member-row__meta strong {
    display: block;
    font-size: 0.88rem;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: min(44vw, 320px);
  }

  .member-row__meta small {
    color: #64748b;
    font-size: 0.75rem;
  }

  .member-row__status {
    display: grid;
    justify-items: end;
    gap: 0.2rem;
    flex-shrink: 0;
  }

  .role {
    border-radius: 999px;
    padding: 0.2rem 0.48rem;
    font:
      600 0.68rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border: 1px solid transparent;
  }

  .role--owner {
    color: #7c2d12;
    background: #ffedd5;
    border-color: #fed7aa;
  }

  .role--admin {
    color: #3730a3;
    background: #e0e7ff;
    border-color: #c7d2fe;
  }

  .role--member {
    color: #155e75;
    background: #cffafe;
    border-color: #a5f3fc;
  }

  .role--viewer {
    color: #334155;
    background: #e2e8f0;
    border-color: #cbd5e1;
  }

  .joined {
    color: #64748b;
    font-size: 0.72rem;
  }

  .avatar {
    width: 1.95rem;
    height: 1.95rem;
    border-radius: 999px;
    background: #e2e8f0;
    color: #0f172a;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font:
      700 0.72rem/1 ui-monospace,
      SFMono-Regular,
      Menlo,
      monospace;
    flex-shrink: 0;
    overflow: hidden;
  }

  .avatar--image {
    object-fit: cover;
    border: 1px solid #cbd5e1;
    background: #fff;
  }

  @media (max-width: 720px) {
    .member-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .member-row__status {
      width: 100%;
      justify-items: start;
    }

    .member-row__meta strong {
      max-width: 72vw;
    }
  }
</style>
