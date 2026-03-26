import { derived, writable } from "svelte/store";

const initialState = {
  workspaces: [],
  currentWorkspaceId: null,
  roleByWorkspace: {},
  membersByWorkspace: {},
};

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function asString(value) {
  return String(value ?? "").trim();
}

function normalizeWorkspace(workspace = {}) {
  const id = asString(workspace.id);
  if (!id) return null;

  return {
    id,
    name: asString(workspace.name) || "Workspace",
    slug: asString(workspace.slug) || null,
    plan: asString(workspace.plan) || "free",
    role: asString(workspace.role) || null,
    metadata: workspace.metadata && typeof workspace.metadata === "object" ? workspace.metadata : {},
    createdAt: workspace.createdAt ?? workspace.created_at ?? null,
    updatedAt: workspace.updatedAt ?? workspace.updated_at ?? null,
  };
}

function normalizeMember(member = {}) {
  const workspaceId = asString(member.workspaceId ?? member.workspace_id);
  const userId = asString(member.userId ?? member.user_id);
  if (!workspaceId || !userId) return null;

  return {
    workspaceId,
    userId,
    role: asString(member.role) || "viewer",
    joinedAt: member.joinedAt ?? member.created_at ?? null,
    profile: member.profile && typeof member.profile === "object" ? member.profile : null,
  };
}

function toRoleMap(workspaces = []) {
  const roleMap = {};
  for (const ws of workspaces) {
    if (ws?.id && ws?.role) roleMap[ws.id] = ws.role;
  }
  return roleMap;
}

function pickCurrentWorkspaceId(workspaces, preferredId) {
  const preferred = asString(preferredId);
  if (preferred && workspaces.some((w) => w.id === preferred)) return preferred;
  return workspaces[0]?.id ?? null;
}

export const workspaceState = writable(clone(initialState));

export const allWorkspaces = derived(workspaceState, ($state) => $state.workspaces);

export const currentWorkspaceId = derived(
  workspaceState,
  ($state) => $state.currentWorkspaceId,
);

export const currentWorkspace = derived(workspaceState, ($state) => {
  return (
    $state.workspaces.find((w) => w.id === $state.currentWorkspaceId) ?? null
  );
});

export const currentRole = derived(workspaceState, ($state) => {
  const id = $state.currentWorkspaceId;
  if (!id) return null;

  if ($state.roleByWorkspace[id]) return $state.roleByWorkspace[id];
  const ws = $state.workspaces.find((w) => w.id === id);
  return ws?.role ?? null;
});

export const workspaceMembers = derived(workspaceState, ($state) => {
  const id = $state.currentWorkspaceId;
  if (!id) return [];
  return $state.membersByWorkspace[id] ?? [];
});

export function resetWorkspaceStore() {
  workspaceState.set(clone(initialState));
}

export function setWorkspaces(workspaces = [], preferredWorkspaceId = null) {
  const normalized = (Array.isArray(workspaces) ? workspaces : [])
    .map(normalizeWorkspace)
    .filter(Boolean);

  workspaceState.update((state) => {
    const currentWorkspaceId = pickCurrentWorkspaceId(
      normalized,
      preferredWorkspaceId ?? state.currentWorkspaceId,
    );

    return {
      ...state,
      workspaces: normalized,
      currentWorkspaceId,
      roleByWorkspace: {
        ...toRoleMap(normalized),
        ...state.roleByWorkspace,
      },
    };
  });
}

export function setCurrentWorkspace(workspaceId) {
  const id = asString(workspaceId);

  workspaceState.update((state) => {
    if (!id) return { ...state, currentWorkspaceId: null };
    const exists = state.workspaces.some((w) => w.id === id);
    return { ...state, currentWorkspaceId: exists ? id : state.currentWorkspaceId };
  });
}

export function setCurrentRole(role) {
  const normalizedRole = asString(role) || null;

  workspaceState.update((state) => {
    const id = state.currentWorkspaceId;
    if (!id) return state;
    return {
      ...state,
      roleByWorkspace: {
        ...state.roleByWorkspace,
        [id]: normalizedRole,
      },
    };
  });
}

export function setWorkspaceMembers(workspaceId, members = []) {
  const id = asString(workspaceId);
  if (!id) return;

  const normalized = (Array.isArray(members) ? members : [])
    .map(normalizeMember)
    .filter((m) => m && m.workspaceId === id);

  workspaceState.update((state) => ({
    ...state,
    membersByWorkspace: {
      ...state.membersByWorkspace,
      [id]: normalized,
    },
  }));
}

export function setCurrentWorkspaceMembers(members = []) {
  workspaceState.update((state) => {
    const id = state.currentWorkspaceId;
    if (!id) return state;

    const normalized = (Array.isArray(members) ? members : [])
      .map(normalizeMember)
      .filter((m) => m && m.workspaceId === id);

    return {
      ...state,
      membersByWorkspace: {
        ...state.membersByWorkspace,
        [id]: normalized,
      },
    };
  });
}

export function hydrateWorkspaceStore(payload = {}) {
  const workspaces = Array.isArray(payload.workspaces) ? payload.workspaces : [];
  const currentWorkspaceObj = payload.currentWorkspace ?? null;
  const currentWorkspaceId = asString(
    payload.currentWorkspaceId ?? currentWorkspaceObj?.id,
  );

  setWorkspaces(workspaces, currentWorkspaceId || null);

  if (payload.currentRole) {
    setCurrentRole(payload.currentRole);
  }

  if (Array.isArray(payload.workspaceMembers)) {
    setCurrentWorkspaceMembers(payload.workspaceMembers);
  }

  if (payload.membersByWorkspace && typeof payload.membersByWorkspace === "object") {
    for (const [workspaceId, members] of Object.entries(payload.membersByWorkspace)) {
      setWorkspaceMembers(workspaceId, members);
    }
  }
}

export default {
  workspaceState,
  allWorkspaces,
  currentWorkspaceId,
  currentWorkspace,
  currentRole,
  workspaceMembers,
  resetWorkspaceStore,
  setWorkspaces,
  setCurrentWorkspace,
  setCurrentRole,
  setWorkspaceMembers,
  setCurrentWorkspaceMembers,
  hydrateWorkspaceStore,
};
