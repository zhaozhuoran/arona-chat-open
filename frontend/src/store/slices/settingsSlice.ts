import type { StateCreator } from "zustand";
import {
  type Store,
  type ModelOption,
  type ChatGenerationSettings,
  type LogLevel,
  type AttachmentLibraryItem,
  type LibraryItem,
  type MessageAttachmentType,
  DEFAULT_MODEL,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_LOG_LEVEL,
  ensureToken,
  requestJson,
  normalizeChatSettings,
  normalizeLogLevel,
  resolveAttachmentType,
  convertImageToSdrIfPossible,
  uploadFileWithRetry,
  cancelUploadSession,
  parseApiError,
} from "../useStore";

export interface SettingsSliceState {
  models: ModelOption[];
  selectedModel: string;
  titleModel: string;
  chatSettings: ChatGenerationSettings;
  logLevel: LogLevel;
  systemPromptTimezone: string;
  showArchivedSessions: boolean;
  apiCallMode: "sdk" | "fetch";
  attachmentLibrary: AttachmentLibraryItem[];
  attachmentLibraryLoading: boolean;
  libraryItems: LibraryItem[];
  libraryLoading: boolean;
}

export interface SettingsSliceActions {
  refreshModels: () => Promise<void>;
  setSelectedModel: (model: string) => Promise<void>;
  setTitleModel: (model: string) => Promise<void>;
  setChatSettings: (payload: Partial<ChatGenerationSettings>) => Promise<void>;
  setLogLevel: (level: LogLevel) => Promise<void>;
  setSystemPromptTimezone: (timezone: string) => Promise<void>;
  setShowArchivedSessions: (show: boolean) => Promise<void>;
  setApiCallMode: (mode: "sdk" | "fetch") => Promise<void>;
  refreshAttachmentLibrary: () => Promise<void>;
  deleteAttachment: (attachmentId: string) => Promise<void>;
  refreshLibrary: () => Promise<void>;
  uploadLibraryFile: (file: File) => Promise<LibraryItem>;
  deleteLibraryItem: (fileId: string) => Promise<void>;
  uploadAttachment: (file: File, onProgress?: (percent: number) => void) => Promise<{ id: string; file_name: string; mime_type: string; size: number; url: string; type: MessageAttachmentType }>;
}

export type SettingsSlice = SettingsSliceState & SettingsSliceActions;

export const createSettingsSlice: StateCreator<Store, [], [], SettingsSlice> = (set, get) => ({
  models: [],
  selectedModel: DEFAULT_MODEL,
  titleModel: DEFAULT_MODEL,
  chatSettings: DEFAULT_CHAT_SETTINGS,
  logLevel: DEFAULT_LOG_LEVEL,
  systemPromptTimezone: "UTC",
  showArchivedSessions: false,
  apiCallMode: "fetch",
  attachmentLibrary: [],
  attachmentLibraryLoading: false,
  libraryItems: [],
  libraryLoading: false,

  refreshModels: async () => {
    if (get().previewMode) {
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{
      models: ModelOption[];
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
    }>("/api/models", { method: "GET", token });
    set({
      models: data.models || [],
      selectedModel: data.selected_model || DEFAULT_MODEL,
      titleModel: data.title_model || data.selected_model || DEFAULT_MODEL,
      chatSettings: normalizeChatSettings(data.chat_settings),
      logLevel: normalizeLogLevel(data.log_level),
      systemPromptTimezone:
        typeof data.system_prompt_timezone === "string" && data.system_prompt_timezone.trim() ? data.system_prompt_timezone : "UTC",
      showArchivedSessions: Boolean(data.show_archived_sessions),
      apiCallMode: data.api_call_mode || "fetch",
      activeWorkspaceId:
        typeof data.active_workspace_id === "string" && data.active_workspace_id.trim() ? data.active_workspace_id : get().activeWorkspaceId,
      backendBuildHash: typeof data.backend_build_hash === "string" && data.backend_build_hash.trim()
        ? data.backend_build_hash.trim()
        : get().backendBuildHash,
      backendBuildTime: typeof data.backend_build_time === "string" ? data.backend_build_time.trim() : get().backendBuildTime,
      instanceId: data.instance_id || get().instanceId,
      schemaVersion: Number(data.schema_version) || get().schemaVersion,
    });
  },

  setSelectedModel: async (model) => {
    const trimmed = model.trim();
    if (!trimmed) {
      throw new Error("Model is required.");
    }
    if (get().previewMode) {
      set({ selectedModel: trimmed });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ selected_model: string }>("/api/settings/model", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: trimmed }),
    });
    set({ selectedModel: data.selected_model });
  },

  setTitleModel: async (model) => {
    const trimmed = model.trim();
    if (!trimmed) {
      throw new Error("Model is required.");
    }
    if (get().previewMode) {
      set({ titleModel: trimmed });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ title_model: string }>("/api/settings/title-model", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: trimmed }),
    });
    set({ titleModel: data.title_model });
  },

  setChatSettings: async (payload) => {
    if (get().previewMode) {
      set((state) => ({ chatSettings: normalizeChatSettings({ ...state.chatSettings, ...payload }) }));
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ chat_settings: ChatGenerationSettings }>("/api/settings/chat", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    set({ chatSettings: normalizeChatSettings(data.chat_settings) });
  },

  setLogLevel: async (level) => {
    if (get().previewMode) {
      set({ logLevel: normalizeLogLevel(level) });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ log_level: LogLevel }>("/api/settings/log-level", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_level: level }),
    });
    set({ logLevel: normalizeLogLevel(data.log_level) });
  },

  setSystemPromptTimezone: async (timezone) => {
    const trimmed = timezone.trim();
    if (!trimmed) {
      throw new Error("Timezone is required.");
    }
    if (get().previewMode) {
      set({ systemPromptTimezone: trimmed });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ system_prompt_timezone: string }>("/api/settings/system-prompt-timezone", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: trimmed }),
    });
    set({ systemPromptTimezone: data.system_prompt_timezone });
  },

  setShowArchivedSessions: async (show) => {
    if (get().previewMode) {
      set({ showArchivedSessions: show });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ show_archived_sessions: boolean }>("/api/settings/show-archived-sessions", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ show_archived_sessions: show }),
    });
    set({ showArchivedSessions: Boolean(data.show_archived_sessions) });
    await get().refreshSessions();
  },

  setApiCallMode: async (mode) => {
    if (get().previewMode) {
      set({ apiCallMode: mode });
      return;
    }
    const token = ensureToken(get().token);
    const data = await requestJson<{ api_call_mode: "sdk" | "fetch" }>("/api/settings/api-call-mode", {
      method: "PUT",
      token,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_call_mode: mode }),
    });
    set({ apiCallMode: data.api_call_mode });
    get().pushToast(`AI API calling mode switched to ${mode === "sdk" ? "Vercel AI SDK" : "Standard"}.`, "success");
  },

  refreshAttachmentLibrary: async () => {
    if (get().previewMode) {
      set({ attachmentLibrary: [], attachmentLibraryLoading: false });
      return;
    }
    const token = ensureToken(get().token);
    set({ attachmentLibraryLoading: true });
    try {
      const data = await requestJson<{
        attachments: Array<{
          id: string;
          file_name: string;
          mime_type: string;
          size: number;
          access_url: string;
          created_at: number;
          type?: MessageAttachmentType;
        }>;
      }>("/api/attachments", { method: "GET", token });
      const items: AttachmentLibraryItem[] = (data.attachments ?? []).map((item) => ({
        id: item.id,
        file_name: item.file_name,
        mime_type: item.mime_type,
        size: Number(item.size) || 0,
        url: item.access_url,
        type: item.type ?? resolveAttachmentType(item.mime_type || "application/octet-stream"),
        created_at: Number(item.created_at) || 0,
      }));
      set({ attachmentLibrary: items });
    } finally {
      set({ attachmentLibraryLoading: false });
    }
  },

  deleteAttachment: async (attachmentId) => {
    if (get().previewMode) {
      throw new Error("Attachment library is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/attachments/${encodeURIComponent(attachmentId)}`, {
      method: "DELETE",
      token,
    });
    set((state) => ({
      attachmentLibrary: state.attachmentLibrary.filter((item) => item.id !== attachmentId),
      messages: state.messages.map((message) => ({
        ...message,
        attachments: (message.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
      })),
    }));
  },

  refreshLibrary: async () => {
    if (get().previewMode) {
      set({ libraryItems: [], libraryLoading: false });
      return;
    }
    const token = ensureToken(get().token);
    set({ libraryLoading: true });
    try {
      const pageSize = 100;
      const dedup = new Map<string, LibraryItem>();
      let cursor: string | null = null;

      while (true) {
        const params = new URLSearchParams({ limit: String(pageSize) });
        if (cursor) {
          params.set("cursor", cursor);
        }
        const data = await requestJson<{
          files: Array<{
            id: string;
            file_name: string;
            mime_type: string;
            size: number;
            access_url: string;
            created_at: number;
            type?: MessageAttachmentType;
          }>;
          pagination?: {
            next_cursor?: string | null;
          };
        }>(`/api/library?${params.toString()}`, { method: "GET", token });

        for (const item of data.files ?? []) {
          dedup.set(item.id, {
            id: item.id,
            file_name: item.file_name,
            mime_type: item.mime_type,
            size: Number(item.size) || 0,
            url: item.access_url,
            type: item.type ?? resolveAttachmentType(item.mime_type || "application/octet-stream"),
            created_at: Number(item.created_at) || 0,
          });
        }

        const nextCursor = data.pagination?.next_cursor?.trim() || null;
        if (!nextCursor || nextCursor === cursor) {
          break;
        }
        cursor = nextCursor;
      }
      const items = Array.from(dedup.values());
      set({ libraryItems: items });
    } finally {
      set({ libraryLoading: false });
    }
  },

  uploadLibraryFile: async (file) => {
    if (get().previewMode) {
      throw new Error("Library is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    const settings = get().chatSettings;
    const processedFile = await convertImageToSdrIfPossible(file, {
      enabled: settings.image_compression_enabled,
      maxDimension: settings.image_max_dimension,
    });
    const mimeType = processedFile.type || file.type || "application/octet-stream";

    const session = await requestJson<{ session_id: string; upload_url: string; object_key: string }>(
      "/api/upload-sessions",
      {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intended_type: "library",
          file_name: processedFile.name,
          mime_type: mimeType,
          size: processedFile.size,
        }),
      },
    );

    const upload = await uploadFileWithRetry(session.upload_url, processedFile, mimeType, token);
    if (!upload.ok) {
      await cancelUploadSession(session.session_id, token);
      throw new Error(`Library upload failed: ${await parseApiError(upload)}`);
    }

    const metadata = await requestJson<{ id: string; access_url: string }>(
      `/api/upload-sessions/${session.session_id}/confirm`,
      { method: "POST", token },
    );

    if (!metadata.access_url || !metadata.id) {
      throw new Error("Library file URL is missing.");
    }
    return {
      id: metadata.id,
      file_name: processedFile.name,
      mime_type: mimeType,
      size: processedFile.size,
      url: metadata.access_url,
      type: resolveAttachmentType(mimeType),
      created_at: Date.now(),
    };
  },

  deleteLibraryItem: async (fileId) => {
    if (get().previewMode) {
      throw new Error("Library is not available in preview mode.");
    }
    const token = ensureToken(get().token);
    await requestJson<{ success: boolean }>(`/api/library/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      token,
    });
    set((state) => ({
      libraryItems: state.libraryItems.filter((item) => item.id !== fileId),
      messages: state.messages.map((message) => ({
        ...message,
        attachments: (message.attachments ?? []).filter((attachment) => attachment.id !== fileId),
      })),
    }));
  },

  uploadAttachment: async (file, onProgress) => {
    if (get().previewMode) {
      throw new Error("File attachments are not available in preview mode.");
    }
    const token = ensureToken(get().token);
    const settings = get().chatSettings;
    const processedFile = await convertImageToSdrIfPossible(file, {
      enabled: settings.image_compression_enabled,
      maxDimension: settings.image_max_dimension,
    });
    const mimeType = processedFile.type || file.type || "application/octet-stream";

    onProgress?.(0);

    const session = await requestJson<{ session_id: string; upload_url: string; object_key: string }>(
      "/api/upload-sessions",
      {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intended_type: "attachment",
          file_name: processedFile.name,
          mime_type: mimeType,
          size: processedFile.size,
          conversation_id: get().sessionId ?? "draft",
        }),
      },
    );

    const upload = await uploadFileWithRetry(session.upload_url, processedFile, mimeType, token, onProgress);
    if (!upload.ok) {
      await cancelUploadSession(session.session_id, token);
      throw new Error(`Attachment upload failed: ${await parseApiError(upload)}`);
    }

    onProgress?.(100);
    const metadata = await requestJson<{ id: string; access_url: string }>(
      `/api/upload-sessions/${session.session_id}/confirm`,
      { method: "POST", token },
    );
    if (!metadata.access_url || !metadata.id) {
      throw new Error("Attachment URL is missing.");
    }
    return {
      id: metadata.id,
      file_name: processedFile.name,
      mime_type: mimeType,
      size: processedFile.size,
      url: metadata.access_url,
      type: resolveAttachmentType(mimeType),
    };
  },
});
