import type { StateCreator } from "zustand";
import {
  type Store,
  type AiProvider,
  type AiModel,
  type AdminUser,
  type UsageSummary,
  type UserLimitsStatus,
  type UserProfile,
  ZERO_SESSION_USAGE,
  ensureToken,
  requestJson,
  getErrorMessage,
  getCurrentUtcDate,
} from "../useStore";

export interface AdminSliceState {
  aiProviders: AiProvider[];
  aiProvidersLoading: boolean;
  aiModels: AiModel[];
  aiModelsLoading: boolean;
  encryptionKeyReady: boolean;
  adminUsers: AdminUser[];
  adminUsersLoading: boolean;
  usage: UsageSummary | null;
  dailyUsage: UsageSummary | null;
  dailyUsageDate: string | null;
  userLimits: UserLimitsStatus | null;
  sessionUsage: { total_tokens: number; total_cost_usd: number };
}

export interface AdminSliceActions {
  refreshAiProviders: () => Promise<void>;
  createAiProvider: (payload: { name: string; endpoint: string; api_key: string; visibility: string }) => Promise<void>;
  updateAiProvider: (id: string, payload: Partial<{ name: string; endpoint: string; api_key: string; visibility: string }>) => Promise<void>;
  deleteAiProvider: (id: string) => Promise<void>;
  refreshAiModels: () => Promise<void>;
  createAiModel: (payload: { provider_id: string; model_id: string; name: string; input_usd_per_million: number; output_usd_per_million: number }) => Promise<void>;
  updateAiModel: (id: string, payload: Partial<{ provider_id: string; model_id: string; name: string; input_usd_per_million: number; output_usd_per_million: number }>) => Promise<void>;
  deleteAiModel: (id: string) => Promise<void>;
  fetchUpstreamModels: () => Promise<{ data: { id: string; name: string; pricing?: { prompt?: number; input?: number; completion?: number; output?: number } }[] }>;
  refreshAdminUsers: () => Promise<void>;
  updateUserPermissions: (userId: string, payload: { is_admin?: boolean; can_manage_ai?: boolean; can_view_all_users?: boolean }) => Promise<void>;
  updateUserBudget: (userId: string, payload: { daily_budget_enabled?: boolean; daily_budget_usd?: number }) => Promise<void>;
  refreshUsage: () => Promise<void>;
  syncUsageAggregate: () => Promise<void>;
  refreshSessionUsage: (sessionId?: string | null) => Promise<void>;
}

export type AdminSlice = AdminSliceState & AdminSliceActions;

export const createAdminSlice: StateCreator<Store, [], [], AdminSlice> = (set, get) => ({
  aiProviders: [],
  aiProvidersLoading: false,
  aiModels: [],
  aiModelsLoading: false,
  encryptionKeyReady: false,
  adminUsers: [],
  adminUsersLoading: false,
  usage: null,
  dailyUsage: null,
  dailyUsageDate: null,
  userLimits: null,
  sessionUsage: ZERO_SESSION_USAGE,

  refreshAiProviders: async () => {
    if (get().previewMode) return;
    const token = ensureToken(get().token);
    set({ aiProvidersLoading: true });
    try {
      const data = await requestJson<{ providers: AiProvider[]; encryption_key_ready: boolean }>("/api/settings/ai-providers", { method: "GET", token });
      set({ aiProviders: data.providers, encryptionKeyReady: data.encryption_key_ready });
    } finally {
      set({ aiProvidersLoading: false });
    }
  },

  createAiProvider: async (payload) => {
    const token = ensureToken(get().token);
    await requestJson("/api/settings/ai-providers", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await get().refreshAiProviders();
    get().pushToast("AI Provider created.", "success");
  },

  updateAiProvider: async (id, payload) => {
    const token = ensureToken(get().token);
    await requestJson(`/api/settings/ai-providers/${encodeURIComponent(id)}`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await get().refreshAiProviders();
    get().pushToast("AI Provider updated.", "success");
  },

  deleteAiProvider: async (id) => {
    const token = ensureToken(get().token);
    await requestJson(`/api/settings/ai-providers/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token,
    });
    await get().refreshAiProviders();
    get().pushToast("AI Provider deleted.", "success");
  },

  refreshAiModels: async () => {
    if (get().previewMode) return;
    const token = ensureToken(get().token);
    set({ aiModelsLoading: true });
    try {
      const data = await requestJson<{ models: AiModel[] }>("/api/settings/ai-models", { method: "GET", token });
      set({ aiModels: data.models });
    } finally {
      set({ aiModelsLoading: false });
    }
  },

  createAiModel: async (payload) => {
    const token = ensureToken(get().token);
    await requestJson("/api/settings/ai-models", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await get().refreshAiModels();
    await get().refreshModels();
    get().pushToast("AI Model added.", "success");
  },

  updateAiModel: async (id, payload) => {
    const token = ensureToken(get().token);
    await requestJson(`/api/settings/ai-models/${encodeURIComponent(id)}`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await get().refreshAiModels();
    await get().refreshModels();
    get().pushToast("AI Model updated.", "success");
  },

  deleteAiModel: async (id) => {
    const token = ensureToken(get().token);
    await requestJson(`/api/settings/ai-models/${encodeURIComponent(id)}`, {
      method: "DELETE",
      token,
    });
    await get().refreshAiModels();
    await get().refreshModels();
    get().pushToast("AI Model deleted.", "success");
  },

  fetchUpstreamModels: async () => {
    const token = ensureToken(get().token);
    return requestJson("/api/settings/ai-models/upstream", { method: "GET", token });
  },

  refreshAdminUsers: async () => {
    if (get().previewMode) return;
    const token = ensureToken(get().token);
    set({ adminUsersLoading: true });
    try {
      const data = await requestJson<{ users: AdminUser[] }>("/api/admin/users", { method: "GET", token });
      set({ adminUsers: data.users });
    } finally {
      set({ adminUsersLoading: false });
    }
  },

  updateUserPermissions: async (userId, payload) => {
    const token = ensureToken(get().token);
    await requestJson(`/api/admin/users/${encodeURIComponent(userId)}/permissions`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await get().refreshAdminUsers();
    get().pushToast("User permissions updated.", "success");
  },

  updateUserBudget: async (userId, payload) => {
    const token = ensureToken(get().token);
    await requestJson(`/api/admin/users/${encodeURIComponent(userId)}/budget`, {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await get().refreshAdminUsers();
    get().pushToast("User budget updated.", "success");
  },

  refreshUsage: async () => {
    if (get().previewMode) {
      return;
    }
    const token = ensureToken(get().token);
    const dateUtc = getCurrentUtcDate();
    const [allData, dailyData] = await Promise.allSettled([
      requestJson<{ summary: UsageSummary; limits?: UserLimitsStatus }>("/api/stats/usage", {
        method: "GET",
        token,
      }),
      requestJson<{ summary: UsageSummary; limits?: UserLimitsStatus }>(`/api/stats/usage?date_utc=${encodeURIComponent(dateUtc)}`, {
        method: "GET",
        token,
      }),
    ]);
    const next: {
      usage?: UsageSummary;
      dailyUsage?: UsageSummary | null;
      dailyUsageDate?: string | null;
      userLimits?: UserLimitsStatus | null;
    } = {};

    let hasSuccess = false;
    if (allData.status === "fulfilled") {
      next.usage = allData.value.summary;
      if (allData.value.limits) {
        next.userLimits = allData.value.limits;
      }
      hasSuccess = true;
    }
    if (dailyData.status === "fulfilled") {
      next.dailyUsage = dailyData.value.summary;
      next.dailyUsageDate = dateUtc;
      if (dailyData.value.limits) {
        next.userLimits = dailyData.value.limits;
      }
      hasSuccess = true;
    } else {
      next.dailyUsage = null;
      next.dailyUsageDate = dateUtc;
    }

    if (hasSuccess) {
      set(next);
      return;
    }

    console.error("Failed to refresh usage summaries", {
      all_error: allData.status === "rejected" ? allData.reason : null,
      daily_error: dailyData.status === "rejected" ? dailyData.reason : null,
    });
  },

  syncUsageAggregate: async () => {
    if (get().previewMode) {
      return;
    }
    const token = ensureToken(get().token);
    try {
      const data = await requestJson<{ profile: UserProfile }>("/api/settings/usage/sync", {
        method: "PUT",
        token,
      });
      set({ profile: data.profile });
      await get().refreshUsage();
      get().pushToast("Usage statistics recalculated and synchronized.", "success");
    } catch (error) {
      get().pushToast(`Sync failed: ${getErrorMessage(error)}`, "error");
    }
  },

  refreshSessionUsage: async (sessionId) => {
    if (get().previewMode) {
      return;
    }
    const activeSessionId = sessionId ?? get().sessionId;
    if (!activeSessionId) {
      set({ sessionUsage: ZERO_SESSION_USAGE });
      return;
    }

    const token = ensureToken(get().token);
    const data = await requestJson<{ summary: UsageSummary }>(
      `/api/stats/usage?session_id=${encodeURIComponent(activeSessionId)}`,
      {
        method: "GET",
        token,
      },
    );
    set({
      sessionUsage: {
        total_tokens: Number(data.summary?.total_tokens ?? 0),
        total_cost_usd: Number(data.summary?.total_cost_usd ?? 0),
      },
    });
  },
});
