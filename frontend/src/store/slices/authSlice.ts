import type { StateCreator } from "zustand";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  type Store,
  type UserProfile,
  type UserLimitsStatus,
  type AuthMethod,
  type LogLevel,
  type PasskeyInfo,
  type ChatGenerationSettings,
  ZERO_SESSION_USAGE,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_MODEL,
  DEFAULT_LOG_LEVEL,
  DEFAULT_BACKEND_BUILD_HASH,
  DEFAULT_BACKEND_BUILD_TIME,
  TOKEN_STORAGE_KEY,
  PREVIEW_MODE_STORAGE_KEY,
  PREVIEW_MOCK_PROFILE,
  PREVIEW_MOCK_MODELS,
  PREVIEW_MOCK_USAGE,
  PREVIEW_MOCK_LIMITS,
  buildPreviewSessions,
  buildPreviewMessages,
  previewSessionMessages,
  requestJson,
  getErrorMessage,
  getCurrentUtcDate,
  normalizeChatSettings,
  normalizeLogLevel,
  warnBudget,
  cropImageToSquare,
  uploadFileWithRetry,
  cancelUploadSession,
  ensureToken,
  isPreviewAvailable,
} from "../useStore";

export interface AuthSliceState {
  authReady: boolean;
  authLoading: boolean;
  authenticated: boolean;
  authMethod: AuthMethod | null;
  token: string | null;
  isAdmin: boolean;
  canManageAi: boolean;
  canViewAllUsers: boolean;
  limitsEnabled: boolean;
  previewMode: boolean;
  backendBuildHash: string;
  backendBuildTime: string;
  instanceId: string;
  schemaVersion: number;
  profile: UserProfile | null;
  passkeys: PasskeyInfo[];
  clerkGetToken: ((options?: { skipCache?: boolean }) => Promise<string | null>) | null;
  accessDenied: boolean;
  accessDeniedMessage: string | null;
}

export interface AuthSliceActions {
  refreshClerkToken: (force?: boolean) => Promise<string | null>;
  setAccessDenied: (denied: boolean, message?: string | null) => void;
  setToken: (token: string | null) => void;
  initialize: (clerkGetToken?: (options?: { skipCache?: boolean }) => Promise<string | null>) => Promise<void>;
  loginWithPassword: (password: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  loginWithPreviewPassword: () => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (payload: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  refreshPasskeys: () => Promise<void>;
  registerPasskey: (nickname?: string) => Promise<void>;
  removePasskey: (credentialId: string) => Promise<void>;
}

export type AuthSlice = AuthSliceState & AuthSliceActions;

export const createAuthSlice: StateCreator<Store, [], [], AuthSlice> = (set, get) => ({
  authReady: false,
  authLoading: false,
  authenticated: false,
  authMethod: null,
  token: null,
  isAdmin: false,
  canManageAi: false,
  canViewAllUsers: false,
  limitsEnabled: false,
  previewMode: false,
  backendBuildHash: DEFAULT_BACKEND_BUILD_HASH,
  backendBuildTime: DEFAULT_BACKEND_BUILD_TIME,
  instanceId: "",
  schemaVersion: 0,
  profile: null,
  passkeys: [],
  clerkGetToken: null,
  accessDenied: false,
  accessDeniedMessage: null,

  setAccessDenied: (denied, message = null) => set({ accessDenied: denied, accessDeniedMessage: message }),
  setToken: (token) => set({ token }),

  refreshClerkToken: async (force = false) => {
    const { clerkGetToken } = get();
    if (!clerkGetToken) {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) {
        set({ token });
      }
      return token;
    }
    try {
      const token = await clerkGetToken({ skipCache: force });
      set({ token });
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
      return token;
    } catch (error) {
      console.error("Failed to refresh Clerk token", error);
      return null;
    }
  },

  initialize: async (clerkGetToken) => {
    set({ authLoading: true, clerkGetToken: clerkGetToken ?? null });

    if (get().previewMode || (isPreviewAvailable() && typeof window !== "undefined" && sessionStorage.getItem(PREVIEW_MODE_STORAGE_KEY) === "1")) {
      const mockSessions = buildPreviewSessions();
      const mockMessages = buildPreviewMessages();
      previewSessionMessages.clear();
      for (const [id, msgs] of Object.entries(mockMessages)) {
        previewSessionMessages.set(id, msgs);
      }
      set({
        authReady: true,
        authLoading: false,
        authenticated: true,
        authMethod: "preview",
        token: null,
        previewMode: true,
        isAdmin: true,
        backendBuildHash: "preview",
        backendBuildTime: "",
        instanceId: "preview-user",
        schemaVersion: 20,
        profile: { ...PREVIEW_MOCK_PROFILE, updated_at: Date.now() },
        sessions: mockSessions,
        models: PREVIEW_MOCK_MODELS,
        usage: PREVIEW_MOCK_USAGE,
        dailyUsage: PREVIEW_MOCK_USAGE,
        dailyUsageDate: getCurrentUtcDate(),
        userLimits: PREVIEW_MOCK_LIMITS,
        selectedModel: DEFAULT_MODEL,
        titleModel: DEFAULT_MODEL,
        chatSettings: DEFAULT_CHAT_SETTINGS,
        logLevel: DEFAULT_LOG_LEVEL,
        systemPromptTimezone: "UTC",
        showArchivedSessions: false,
        apiCallMode: "fetch",
        workspaces: [{ id: "default", name: "Default Workspace", archived_at: null, created_at: Date.now(), updated_at: Date.now() }],
        activeWorkspaceId: "default",
        passkeys: [],
        sessionUsage: ZERO_SESSION_USAGE,
        sessionId: null,
        messages: [],
        attachmentLibrary: [],
        attachmentLibraryLoading: false,
        libraryItems: [],
        libraryLoading: false,
        aiProviders: [
          {
            id: 'preview-provider-uuid',
            name: 'Preview Provider',
            endpoint: 'https://api.openai.com/v1',
            api_key_masked: 'sk-preview-123...def',
            is_built_in: false,
            owner_id: null,
            owner_email: null,
            visibility: 'private',
            created_at: Date.now(),
            updated_at: Date.now(),
          },
          {
            id: 'preview-error-provider',
            name: 'Error Provider',
            endpoint: 'https://api.example.com',
            api_key_masked: 'Decrypt Error',
            is_built_in: false,
            owner_id: null,
            owner_email: null,
            visibility: 'private',
            created_at: Date.now(),
            updated_at: Date.now(),
          }
        ],
        aiProvidersLoading: false,
        aiModels: [
          {
            id: 'preview-model-uuid',
            provider_id: 'preview-provider-uuid',
            model_id: 'openai/gpt-4o',
            name: 'GPT-4o (Preview)',
            input_usd_per_million: 2.5,
            output_usd_per_million: 10,
            is_active: true,
            created_at: Date.now(),
            updated_at: Date.now(),
            provider_name: 'Preview Provider',
          }
        ],
        aiModelsLoading: false,
        encryptionKeyReady: true,
        streamFailure: null,
      });
      return;
    }

    let effectiveToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (clerkGetToken) {
      try {
        effectiveToken = await clerkGetToken();
      } catch (error) {
        console.error("Failed to get Clerk token during initialize", error);
      }
    }

    if (!effectiveToken) {
      set({
        authReady: true,
        authLoading: false,
        authenticated: false,
        token: null,
        streamFailure: null,
      });
      return;
    }

    try {
      const me = await requestJson<{
        method: AuthMethod;
        is_admin?: boolean;
        can_manage_ai?: boolean;
        can_view_all_users?: boolean;
        profile: UserProfile;
        selected_model: string;
        title_model: string;
        chat_settings?: Partial<ChatGenerationSettings>;
        log_level?: LogLevel;
        system_prompt_timezone?: string;
        show_archived_sessions?: boolean;
        active_workspace_id?: string;
        api_call_mode?: "sdk" | "fetch";
        backend_build_hash?: string;
        backend_build_time?: string;
        instance_id?: string;
        schema_version?: number | string;
        limits_enabled?: boolean;
        limits?: UserLimitsStatus | null;
      }>("/api/auth/me", { method: "GET", token: effectiveToken });

      set({
        token: effectiveToken,
        authenticated: true,
        authMethod: me.method,
        isAdmin: Boolean(me.is_admin),
        canManageAi: Boolean(me.can_manage_ai),
        canViewAllUsers: Boolean(me.can_view_all_users),
        limitsEnabled: Boolean(me.limits_enabled),
        accessDenied: false,
        accessDeniedMessage: null,
        backendBuildHash: typeof me.backend_build_hash === "string" && me.backend_build_hash.trim()
          ? me.backend_build_hash.trim()
          : DEFAULT_BACKEND_BUILD_HASH,
        backendBuildTime: typeof me.backend_build_time === "string" ? me.backend_build_time.trim() : DEFAULT_BACKEND_BUILD_TIME,
        profile: me.profile,
        instanceId: me.instance_id || "",
        schemaVersion: Number(me.schema_version) || 0,
        selectedModel: me.selected_model || DEFAULT_MODEL,
        titleModel: me.title_model || me.selected_model || DEFAULT_MODEL,
        chatSettings: normalizeChatSettings(me.chat_settings),
        logLevel: normalizeLogLevel(me.log_level),
        systemPromptTimezone: typeof me.system_prompt_timezone === "string" && me.system_prompt_timezone.trim() ? me.system_prompt_timezone : "UTC",
        showArchivedSessions: Boolean(me.show_archived_sessions),
        apiCallMode: me.api_call_mode || "fetch",
        activeWorkspaceId: typeof me.active_workspace_id === "string" && me.active_workspace_id.trim() ? me.active_workspace_id : null,
        userLimits: me.limits || null,
      });

      await Promise.all([
        get().refreshWorkspaces(true),
        get().refreshSessions(),
        get().refreshUsage(),
        get().refreshSessionUsage(),
        get().refreshModels(),
        get().refreshAiProviders(),
        get().refreshAiModels(),
        get().refreshPasskeys(),
      ]);
      warnBudget(get());
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes("Access Denied") || errorMessage.includes("whitelist")) {
        set({ accessDenied: true, accessDeniedMessage: errorMessage });
      }
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      set({
        token: null,
        authenticated: false,
        authMethod: null,
        isAdmin: false,
        canManageAi: false,
        canViewAllUsers: false,
        limitsEnabled: false,
        backendBuildHash: DEFAULT_BACKEND_BUILD_HASH,
        backendBuildTime: DEFAULT_BACKEND_BUILD_TIME,
        instanceId: "",
        schemaVersion: 0,
        sessions: [],
        sessionId: null,
        messages: [],
        streamingReasoning: "",
        profile: null,
        usage: null,
        dailyUsage: null,
        dailyUsageDate: null,
        sessionUsage: ZERO_SESSION_USAGE,
        titleModel: DEFAULT_MODEL,
        chatSettings: DEFAULT_CHAT_SETTINGS,
        logLevel: DEFAULT_LOG_LEVEL,
        systemPromptTimezone: "UTC",
        showArchivedSessions: false,
        workspaces: [],
        activeWorkspaceId: null,
        aiProviders: [],
        aiModels: [],
        adminUsers: [],
        streamFailure: null,
      });
      console.error(error);
    } finally {
      set({ authReady: true, authLoading: false });
    }
  },

  loginWithPassword: async (password) => {
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      throw new Error("Password is required.");
    }

    set({ authLoading: true });
    try {
      const data = await requestJson<{ token: string }>("/api/auth/password-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmedPassword }),
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      set({
        token: data.token,
        authenticated: true,
        authMethod: "password",
        streamRecovery: null,
        streamFailure: null,
      });

      await Promise.all([
        get().refreshProfile(),
        get().refreshWorkspaces(true),
        get().refreshSessions(),
        get().refreshUsage(),
        get().refreshSessionUsage(),
        get().refreshModels(),
      ]);
      void get().refreshAttachmentLibrary().catch((error) => {
        console.error("Failed to refresh attachment library after password login", error);
      });
      void get().refreshLibrary().catch((error) => {
        console.error("Failed to refresh library after password login", error);
      });
      await get().refreshPasskeys();
      get().pushToast("Logged in with password.", "success");
    } catch (error) {
      const message = getErrorMessage(error);
      get().pushToast(message, "error");
      throw new Error(message);
    } finally {
      set({ authLoading: false });
    }
  },

  loginWithPasskey: async () => {
    set({ authLoading: true });
    try {
      const begin = await requestJson<{ options: Parameters<typeof startAuthentication>[0] }>(
        "/api/auth/passkeys/auth-options",
        { method: "POST" },
      );
      const passkeyResponse = await startAuthentication(begin.options);

      const finish = await requestJson<{ token: string }>("/api/auth/passkeys/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: passkeyResponse }),
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, finish.token);
      set({
        token: finish.token,
        authenticated: true,
        authMethod: "passkey",
        streamRecovery: null,
        streamFailure: null,
      });

      await Promise.all([
        get().refreshProfile(),
        get().refreshWorkspaces(true),
        get().refreshSessions(),
        get().refreshUsage(),
        get().refreshSessionUsage(),
        get().refreshModels(),
      ]);
      void get().refreshAttachmentLibrary().catch((error) => {
        console.error("Failed to refresh attachment library after passkey login", error);
      });
      void get().refreshLibrary().catch((error) => {
        console.error("Failed to refresh library after passkey login", error);
      });
      await get().refreshPasskeys();
      get().pushToast("Logged in with passkey.", "success");
    } catch (error) {
      const message = getErrorMessage(error);
      get().pushToast(message, "error");
      throw new Error(message);
    } finally {
      set({ authLoading: false });
    }
  },

  loginWithPreviewPassword: () => {
    const mockSessions = buildPreviewSessions();
    const mockMessages = buildPreviewMessages();
    previewSessionMessages.clear();
    for (const [id, msgs] of Object.entries(mockMessages)) {
      previewSessionMessages.set(id, msgs);
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.setItem(PREVIEW_MODE_STORAGE_KEY, "1");
    set({
      authenticated: true,
      authMethod: "preview",
      token: null,
      previewMode: true,
      isAdmin: true,
      backendBuildHash: "preview",
      backendBuildTime: "",
      instanceId: "preview-user",
      schemaVersion: 20,
      profile: { ...PREVIEW_MOCK_PROFILE, updated_at: Date.now() },
      sessions: mockSessions,
      models: PREVIEW_MOCK_MODELS,
      usage: PREVIEW_MOCK_USAGE,
      dailyUsage: PREVIEW_MOCK_USAGE,
      dailyUsageDate: getCurrentUtcDate(),
      userLimits: PREVIEW_MOCK_LIMITS,
      selectedModel: DEFAULT_MODEL,
      titleModel: DEFAULT_MODEL,
      chatSettings: DEFAULT_CHAT_SETTINGS,
      logLevel: DEFAULT_LOG_LEVEL,
      systemPromptTimezone: "UTC",
      showArchivedSessions: false,
      workspaces: [{ id: "default", name: "Default Workspace", archived_at: null, created_at: Date.now(), updated_at: Date.now() }],
      activeWorkspaceId: "default",
      passkeys: [],
      sessionUsage: ZERO_SESSION_USAGE,
      sessionId: null,
      messages: [],
      attachmentLibrary: [],
      attachmentLibraryLoading: false,
      libraryItems: [],
      libraryLoading: false,
      aiProviders: [],
      aiProvidersLoading: false,
      aiModels: [],
      aiModelsLoading: false,
      encryptionKeyReady: false,
      adminUsers: [],
      adminUsersLoading: false,
      streamRecovery: null,
      streamFailure: null,
    });
    get().pushToast("Logged in (preview mode — example data only).", "info");
  },

  logout: () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(PREVIEW_MODE_STORAGE_KEY);
    previewSessionMessages.clear();
    set({
      authenticated: false,
      authMethod: null,
      token: null,
      previewMode: false,
      backendBuildHash: DEFAULT_BACKEND_BUILD_HASH,
      backendBuildTime: DEFAULT_BACKEND_BUILD_TIME,
      instanceId: "",
      schemaVersion: 0,
      sessions: [],
      sessionId: null,
      messages: [],
      streamingMessage: "",
      streamingReasoning: "",
      streamingThinkingTopic: "",
      loadingMessages: false,
      sendingMessage: false,
      profile: null,
      usage: null,
      dailyUsage: null,
      dailyUsageDate: null,
      sessionUsage: ZERO_SESSION_USAGE,
      passkeys: [],
      models: [],
      selectedModel: DEFAULT_MODEL,
      titleModel: DEFAULT_MODEL,
      chatSettings: DEFAULT_CHAT_SETTINGS,
      logLevel: DEFAULT_LOG_LEVEL,
      systemPromptTimezone: "UTC",
      showArchivedSessions: false,
      workspaces: [],
      activeWorkspaceId: null,
      attachmentLibrary: [],
      attachmentLibraryLoading: false,
      libraryItems: [],
      libraryLoading: false,
      aiProviders: [],
      aiModels: [],
      encryptionKeyReady: false,
      adminUsers: [],
      adminUsersLoading: false,
      isAdmin: false,
      canManageAi: false,
      canViewAllUsers: false,
      limitsEnabled: false,
      streamRecovery: null,
      streamFailure: null,
    });
  },

  refreshProfile: async () => {
    if (get().previewMode) {
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ profile: UserProfile }>("/api/profile", { method: "GET", token });
    set({ profile: data.profile });
  },

  updateProfile: async (payload) => {
    if (get().previewMode) {
      set((state) => ({ profile: state.profile ? { ...state.profile, ...payload } : null }));
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ profile: UserProfile }>("/api/profile", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    set({ profile: data.profile });
  },

  uploadAvatar: async (file) => {
    if (get().previewMode) {
      get().pushToast("Avatar upload is not available in preview mode.", "error");
      throw new Error("Not available in preview mode.");
    }
    const token = ensureToken(get().token);
    const squareAvatar = await cropImageToSquare(file);
    const mimeType = squareAvatar.type || "application/octet-stream";
    const session = await requestJson<{ session_id: string; upload_url: string; object_key: string }>(
      "/api/upload-sessions",
      {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intended_type: "avatar",
          file_name: squareAvatar.name,
          mime_type: mimeType,
          size: squareAvatar.size,
        }),
      },
    );

    const upload = await uploadFileWithRetry(session.upload_url, squareAvatar, mimeType, token);
    if (!upload.ok) {
      await cancelUploadSession(session.session_id, token);
      throw new Error(`Avatar upload failed: ${upload.statusText}`);
    }

    const confirm = await requestJson<{ id: string }>(
      `/api/upload-sessions/${session.session_id}/confirm`,
      { method: "POST", token },
    );
    await get().updateProfile({ avatar_key: confirm.id });
    get().pushToast("Avatar updated.", "success");
  },

  refreshPasskeys: async () => {
    if (get().previewMode) {
      set({ passkeys: [] });
      return;
    }
    try {
      const token = ensureToken(get().token);
      const data = await requestJson<{ passkeys: PasskeyInfo[] }>("/api/auth/passkeys", { method: "GET", token });
      set({ passkeys: data.passkeys || [] });
    } catch (error) {
      console.warn("Failed to refresh passkeys (it might be retired):", error);
      set({ passkeys: [] });
    }
  },

  registerPasskey: async (nickname) => {
    if (get().previewMode) {
      throw new Error("Passkey management is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    const begin = await requestJson<{ options: Parameters<typeof startRegistration>[0] }>(
      "/api/auth/passkeys/register-options",
      { method: "POST", token },
    );

    const passkeyResponse = await startRegistration(begin.options);
    await requestJson<{ success: boolean }>("/api/auth/passkeys/register-verify", {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response: passkeyResponse,
        nickname: nickname?.trim() || undefined,
      }),
    });

    await get().refreshPasskeys();
    get().pushToast("Passkey registered.", "success");
  },

  removePasskey: async (credentialId) => {
    if (get().previewMode) {
      throw new Error("Passkey management is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`, {
      method: "DELETE",
      token,
    });
    await get().refreshPasskeys();
    get().pushToast("Passkey removed.", "success");
  },
});
