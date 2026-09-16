import type { StateCreator } from "zustand";
import {
  type Store,
  type Workspace,
  ensureToken,
  requestJson,
  ZERO_SESSION_USAGE,
} from "../useStore";

export interface WorkspaceSliceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
}

export interface WorkspaceSliceActions {
  refreshWorkspaces: (includeArchived?: boolean) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  archiveWorkspace: (workspaceId: string, archived?: boolean) => Promise<void>;
  activateWorkspace: (workspaceId: string) => Promise<void>;
}

export type WorkspaceSlice = WorkspaceSliceState & WorkspaceSliceActions;

export const createWorkspaceSlice: StateCreator<Store, [], [], WorkspaceSlice> = (set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,

  refreshWorkspaces: async (includeArchived = true) => {
    if (get().previewMode) {
      return;
    }
    const token = ensureToken(get().token);
    const includeArchivedFlag = includeArchived ? "1" : "0";
    const data = await requestJson<{ workspaces: Workspace[]; active_workspace_id: string }>(
      `/api/workspaces?include_archived=${includeArchivedFlag}`,
      {
        method: "GET",
        token,
      },
    );
    set({
      workspaces: data.workspaces ?? [],
      activeWorkspaceId: data.active_workspace_id || null,
    });
  },

  createWorkspace: async (name) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error("Workspace name is required.");
    }
    if (get().previewMode) {
      const now = Date.now();
      const id = crypto.randomUUID();
      set((state) => ({
        workspaces: [{ id, name: normalizedName, archived_at: null, created_at: now, updated_at: now }, ...state.workspaces],
      }));
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ workspace: Workspace }>("/api/workspaces", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalizedName }),
    });
    await get().refreshWorkspaces(true);
  },

  renameWorkspace: async (workspaceId, name) => {
    const normalizedName = name.trim();
    if (!workspaceId.trim()) {
      throw new Error("Workspace id is required.");
    }
    if (!normalizedName) {
      throw new Error("Workspace name is required.");
    }
    if (get().previewMode) {
      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId ? { ...workspace, name: normalizedName, updated_at: Date.now() } : workspace,
        ),
      }));
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: normalizedName }),
    });
    await get().refreshWorkspaces(true);
  },

  archiveWorkspace: async (workspaceId, archived = true) => {
    if (!workspaceId.trim()) {
      throw new Error("Workspace id is required.");
    }
    if (get().previewMode) {
      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId ? { ...workspace, archived_at: archived ? Date.now() : null, updated_at: Date.now() } : workspace,
        ),
      }));
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/workspaces/${encodeURIComponent(workspaceId)}/archive`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    await get().refreshWorkspaces(true);
    await get().refreshSessions();
  },

  activateWorkspace: async (workspaceId) => {
    if (!workspaceId.trim()) {
      throw new Error("Workspace id is required.");
    }
    if (get().previewMode) {
      set({
        activeWorkspaceId: workspaceId,
        sessions: [],
        sessionId: null,
        messages: [],
        sessionUsage: ZERO_SESSION_USAGE,
      });
      return;
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean; active_workspace_id: string }>(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/activate`,
      {
        method: "PUT",
        token,
      },
    );
    get().clearSession();
    await get().refreshWorkspaces(true);
    await get().refreshSessions();
  },
});
