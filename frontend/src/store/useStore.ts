import { create } from "zustand";
import { API_URL as UNIFIED_API_URL, isPreviewAvailable as UNIFIED_isPreviewAvailable } from "../config";
import type {
  AiProvider,
  AiModel,
  ChatGenerationSettings,
  LogLevel,
  Message,
  MessageAttachment,
  MessageAttachmentType,
  ModelOption,
  PasskeyInfo,
  ReasoningEffort,
  ServiceTier,
  Session,
  UsageSummary,
  UserProfile,
  Workspace,
  DailyBudgetStatus,
  UserLimitsStatus,
} from "@arona-chat/shared";
export type {
  AiProvider,
  AiModel,
  ChatGenerationSettings,
  LogLevel,
  Message,
  MessageAttachment,
  MessageAttachmentType,
  ModelOption,
  PasskeyInfo,
  ReasoningEffort,
  ServiceTier,
  Session,
  UsageSummary,
  UserProfile,
  Workspace,
  DailyBudgetStatus,
  UserLimitsStatus,
};

type ToastType = "success" | "error" | "info";

export interface AdminUser {
  user_id: string;
  username: string;
  email?: string | null;
  is_admin: boolean;
  can_manage_ai: boolean;
  can_view_all_users: boolean;
  total_requests: number;
  total_self_added_requests: number;
  total_cost_usd: number;
  total_self_added_cost_usd: number;
  daily_budget_enabled?: boolean;
  daily_budget_usd?: number;
}

export type ToastItem = {
  id: string;
  type: ToastType;
  message: string;
};

export type AuthMethod = "password" | "passkey" | "preview" | null;

type ProfileUpdatePayload = {
  username?: string;
  avatar_key?: string | null;
  dynamic_background?: boolean;
  theme?: "standard" | "ethereal-light" | "ethereal-dark";
  arona_bubble_style?: "none" | "border";
  ethereal_streaming_style?: "typewriter" | "buffered";
  send_shortcut?: "ctrl_enter" | "enter";
  conversation_library_enabled?: boolean;
};

type ChatSettingsUpdatePayload = Partial<ChatGenerationSettings>;

export type ComposerAttachment = MessageAttachment & {
  status: "uploading" | "ready" | "error";
  local_id: string;
  progress: number;
  error?: string;
};

export type AttachmentLibraryItem = MessageAttachment & {
  created_at: number;
};

export type LibraryItem = AttachmentLibraryItem;

export interface Store {
  authReady: boolean;
  authLoading: boolean;
  authenticated: boolean;
  authMethod: AuthMethod;
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

  sessions: Session[];
  sessionsHasMore: boolean;
  sessionsLoadingMore: boolean;
  sessionId: string | null;
  messages: Message[];
  loadingMessages: boolean;
  sendingMessage: boolean;
  streamingMessage: string;
  streamingReasoning: string;
  streamingThinkingTopic: string;
  streamRecovery: StreamRecoveryState | null;
  streamFailure: StreamFailureState | null;

  profile: UserProfile | null;
  usage: UsageSummary | null;
  dailyUsage: UsageSummary | null;
  dailyUsageDate: string | null;
  userLimits: UserLimitsStatus | null;
  sessionUsage: {
    total_tokens: number;
    total_cost_usd: number;
  };
  passkeys: PasskeyInfo[];
  models: ModelOption[];
  selectedModel: string;
  titleModel: string;
  chatSettings: ChatGenerationSettings;
  logLevel: LogLevel;
  systemPromptTimezone: string;
  showArchivedSessions: boolean;
  apiCallMode: "sdk" | "fetch";
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  attachmentLibrary: AttachmentLibraryItem[];
  attachmentLibraryLoading: boolean;
  libraryItems: LibraryItem[];
  libraryLoading: boolean;

  aiProviders: AiProvider[];
  aiProvidersLoading: boolean;
  aiModels: AiModel[];
  aiModelsLoading: boolean;
  encryptionKeyReady: boolean;

  adminUsers: AdminUser[];
  adminUsersLoading: boolean;

  toasts: ToastItem[];
  pushToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;

  clerkGetToken: ((options?: { template?: string; skipCache?: boolean }) => Promise<string | null>) | null;
  refreshClerkToken: (force?: boolean) => Promise<string | null>;
  initialize: (getToken?: ((options?: { template?: string; skipCache?: boolean }) => Promise<string | null>) | null) => Promise<void>;
  setToken: (token: string | null) => void;
  accessDenied: boolean;
  accessDeniedMessage: string | null;
  setAccessDenied: (denied: boolean, message?: string | null) => void;
  loginWithPassword: (password: string) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  loginWithPreviewPassword: () => void;
  logout: () => void;

  refreshSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  clearSession: () => void;
  sendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  regenerateLastMessage: () => Promise<void>;
  reconnectStream: () => Promise<void>;
  waitForStreamCompletion: () => Promise<void>;

  refreshProfile: () => Promise<void>;
  updateProfile: (payload: ProfileUpdatePayload) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;

  refreshUsage: () => Promise<void>;
  syncUsageAggregate: () => Promise<void>;
  refreshSessionUsage: (sessionId?: string | null) => Promise<void>;
  refreshModels: () => Promise<void>;
  setSelectedModel: (model: string) => Promise<void>;
  setTitleModel: (model: string) => Promise<void>;
  setChatSettings: (payload: ChatSettingsUpdatePayload) => Promise<void>;
  setLogLevel: (level: LogLevel) => Promise<void>;
  setSystemPromptTimezone: (timezone: string) => Promise<void>;
  setShowArchivedSessions: (show: boolean) => Promise<void>;
  setApiCallMode: (mode: "sdk" | "fetch") => Promise<void>;
  refreshWorkspaces: (includeArchived?: boolean) => Promise<void>;
  createWorkspace: (name: string) => Promise<void>;
  renameWorkspace: (workspaceId: string, name: string) => Promise<void>;
  archiveWorkspace: (workspaceId: string, archived?: boolean) => Promise<void>;
  activateWorkspace: (workspaceId: string) => Promise<void>;
  renameSession: (sessionId: string, title: string) => Promise<void>;
  autoGenerateSessionTitle: (sessionId: string) => Promise<void>;
  archiveSession: (sessionId: string, archived?: boolean) => Promise<void>;
  pinSession: (sessionId: string, pinned?: boolean) => Promise<void>;

  refreshPasskeys: () => Promise<void>;
  registerPasskey: (nickname?: string) => Promise<void>;
  removePasskey: (credentialId: string) => Promise<void>;

  uploadAttachment: (file: File, onProgress?: (percent: number) => void) => Promise<MessageAttachment>;
  refreshAttachmentLibrary: () => Promise<void>;
  deleteAttachment: (attachmentId: string) => Promise<void>;
  refreshLibrary: () => Promise<void>;
  uploadLibraryFile: (file: File) => Promise<LibraryItem>;
  deleteLibraryItem: (fileId: string) => Promise<void>;

  refreshAiProviders: () => Promise<void>;
  createAiProvider: (payload: { name: string; endpoint: string; api_key: string; visibility?: string }) => Promise<void>;
  updateAiProvider: (id: string, payload: { name?: string; endpoint?: string; api_key?: string; visibility?: string }) => Promise<void>;
  deleteAiProvider: (id: string) => Promise<void>;

  refreshAdminUsers: () => Promise<void>;
  updateUserPermissions: (userId: string, payload: { can_manage_ai?: boolean; can_view_all_users?: boolean }) => Promise<void>;
  updateUserBudget: (userId: string, payload: { daily_budget_enabled?: boolean; daily_budget_usd?: number }) => Promise<void>;

  refreshAiModels: () => Promise<void>;
  createAiModel: (payload: { provider_id: string; model_id: string; name: string; input_usd_per_million?: number; output_usd_per_million?: number }) => Promise<void>;
  updateAiModel: (id: string, payload: Partial<AiModel>) => Promise<void>;
  deleteAiModel: (id: string) => Promise<void>;
  fetchUpstreamModels: () => Promise<{ data: { id: string; name: string; pricing?: { prompt?: number; input?: number; completion?: number; output?: number } }[] }>;
}

type RequestInitWithAuth = RequestInit & { token?: string | null };

export const API_URL = UNIFIED_API_URL;
export const TOKEN_STORAGE_KEY = "arona-chat.auth-token";
export const PREVIEW_MODE_STORAGE_KEY = "arona-chat.preview-mode";
/** Delay per chunk when simulating streaming in preview mode, chosen to feel like a real stream. */
export const PREVIEW_STREAM_CHUNK_DELAY_MS = 18;
export const SDR_COMPATIBLE_IMAGE_TYPES = ["image/png", "image/webp", "image/jpeg"] as const;
export const DEFAULT_MODEL = "openrouter/auto";
export const ZERO_SESSION_USAGE = { total_tokens: 0, total_cost_usd: 0 };
export const SERVICE_TIER_MULTIPLIERS: Record<string, number> = {
  flex: 0.5,
  default: 1.0,
  priority: 2.5,
};
export const DEFAULT_CHAT_SETTINGS: ChatGenerationSettings = {
  service_tier: "default",
  reasoning_effort: "default",
  max_output_tokens: 64000,
  daily_budget_usd: 10,
  temporary_daily_budget_usd: null,
  temporary_daily_budget_date_utc: null,
  web_search_enabled: false,
  web_search_max_results: 5,
  attachment_mode: "url",
  disable_max_output_tokens: false,
  daily_budget_enabled: true,
  text_file_extraction_mode: "xml",
  image_compression_enabled: true,
  image_max_dimension: 2048,
};
export const DEFAULT_LOG_LEVEL: LogLevel = "INFO";
export const DEFAULT_BACKEND_BUILD_HASH = "unknown";
export const DEFAULT_BACKEND_BUILD_TIME = "";
export const STREAM_INFLIGHT_PREFIX = "arona-chat.stream.inflight.";
export const STREAM_INFLIGHT_MAX_AGE_MS = 10 * 60 * 1000;
export const STREAM_INFLIGHT_PERSIST_MIN_INTERVAL_MS = 500;
export const STREAM_INFLIGHT_PERSIST_MIN_SEQUENCE_DELTA = 24;
export const STREAM_EVENT_CONNECTION_TIMEOUT_MS = 25_000;
export const STREAM_EVENT_STALL_TIMEOUT_MS = 45_000;
export const STREAM_EVENT_POLL_INTERVAL_MS = 1_500;
export const STREAM_EVENT_POLL_MAX_AGE_MS = 120_000;

// ---------------------------------------------------------------------------
// Preview-mode helpers (frontend-only, no backend calls)
// ---------------------------------------------------------------------------

/** Returns true when this is a preview build with VITE_PREVIEW_PASSWORD embedded. */
export const isPreviewAvailable = UNIFIED_isPreviewAvailable;

export const PREVIEW_SESSION_ID_1 = "preview-s1";
export const PREVIEW_SESSION_ID_2 = "preview-s2";

export const PREVIEW_MOCK_PROFILE: UserProfile = {
  username: "Preview Sensei",
  avatar_key: null,
  avatar_url: null,
  dynamic_background: true,
  theme: "ethereal-light",
  arona_bubble_style: "none",
  ethereal_streaming_style: "typewriter",
  send_shortcut: "ctrl_enter",
  conversation_library_enabled: true,
  updated_at: Date.now(),
};

export const buildPreviewSessions = (): Session[] => {
  const now = Date.now();
  return [
    { id: PREVIEW_SESSION_ID_1, title: "Welcome to SCHALE Terminal", created_at: now - 3_600_000, archived_at: null, pinned_at: now - 3_600_000 },
    { id: PREVIEW_SESSION_ID_2, title: "Blue Archive Lore Discussion", created_at: now - 1_800_000, archived_at: null, pinned_at: null },
  ];
};

export const buildPreviewMessages = (): Record<string, Message[]> => {
  const now = Date.now();
  return {
    [PREVIEW_SESSION_ID_1]: [
      { id: "preview-m1", session_id: PREVIEW_SESSION_ID_1, role: "user", content: "Hello Arona! Can you introduce yourself?", attachments: [], created_at: now - 3_500_000, model: null },
      { id: "preview-m2", session_id: PREVIEW_SESSION_ID_1, role: "assistant", content: "Hello, Sensei! I'm Arona, your AI assistant at SCHALE Terminal. I'm here to help you with research, writing, coding, and conversation. What would you like to explore today?", attachments: [], created_at: now - 3_490_000, model: "openrouter/auto" },
      { id: "preview-m3", session_id: PREVIEW_SESSION_ID_1, role: "user", content: "What can you help me with?", attachments: [], created_at: now - 3_480_000, model: null },
      {
        id: "preview-m4", session_id: PREVIEW_SESSION_ID_1, role: "assistant",
        content: "I can assist you with a wide range of tasks:\n\n- **Research & Analysis** — Summarize documents, explain complex topics\n- **Writing & Editing** — Draft, review, or refine any content\n- **Coding** — Write, debug, or explain code in any language\n- **Conversation** — Discuss ideas, stories, or anything on your mind\n\nThis is a **preview build** of SCHALE Terminal. Feel free to explore the interface — sidebar, settings, and example conversations are all available!",
        attachments: [], created_at: now - 3_470_000, model: "openrouter/auto",
      },
    ],
    [PREVIEW_SESSION_ID_2]: [
      { id: "preview-m5", session_id: PREVIEW_SESSION_ID_2, role: "user", content: "Tell me about the Blue Archive lore.", attachments: [], created_at: now - 1_700_000, model: null },
      {
        id: "preview-m6", session_id: PREVIEW_SESSION_ID_2, role: "assistant",
        content: "**Blue Archive** is set in **Kivotos**, a vast city-state governed entirely by students. The story centers on **Schale**, a special task force that resolves crises across the city.\n\nKey factions:\n- **Trinity General School** — A religious institution known for discipline and faith\n- **Millennium Science School** — A technology-focused academy driven by innovation\n- **Gehenna Academy** — A chaotic school with a delinquent culture\n- **Abydos High School** — A remote, nearly abandoned school in the desert\n\nThe **Sensei** (the player) serves as advisor to Schale, and **Arona** is the AI system of the Schale terminal — that's me! 🎮",
        attachments: [], created_at: now - 1_690_000, model: "openrouter/auto",
        reasoning_summary: "The user asked about Blue Archive lore. I should summarize the key world-building elements concisely.",
      },
    ],
  };
};

export const PREVIEW_MOCK_MODELS: ModelOption[] = [
  { id: "openrouter/auto", model_id: "openrouter/auto", name: "Auto (OpenRouter)", pricing: null },
  { id: "anthropic/claude-3.5-sonnet", model_id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", pricing: { input_usd_per_million: 3, output_usd_per_million: 15 } },
  { id: "openai/gpt-4o", model_id: "openai/gpt-4o", name: "GPT-4o", pricing: { input_usd_per_million: 2.5, output_usd_per_million: 10 } },
  { id: "google/gemini-2.0-flash-001", model_id: "google/gemini-2.0-flash-001", name: "Gemini 2.0 Flash", pricing: { input_usd_per_million: 0.1, output_usd_per_million: 0.4 } },
];

export const PREVIEW_MOCK_USAGE: UsageSummary = {
  total_requests: 12,
  total_prompt_tokens: 8420,
  total_completion_tokens: 4180,
  total_tokens: 12600,
  total_cost_usd: 0.0312,
  by_model: [
    { model: "openrouter/auto", requests: 8, prompt_tokens: 5200, completion_tokens: 2800, total_tokens: 8000, cost_usd: 0.0188 },
    { model: "anthropic/claude-3.5-sonnet", requests: 4, prompt_tokens: 3220, completion_tokens: 1380, total_tokens: 4600, cost_usd: 0.0124 },
  ],
};

export const PREVIEW_MOCK_LIMITS: UserLimitsStatus = {
  enabled: true,
  max_daily_req: 50,
  current_daily_req: 12,
  max_storage_mb: 100,
  current_storage_mb: 32.5,
  max_single_file_mb: 25,
};

export const PREVIEW_RESPONSE_TEXTS = [
  "This is a **preview environment** — real AI responses are not available here, but you can explore the full interface.\n\nSCHALE Terminal supports Markdown, code blocks, LaTeX math, reasoning traces, and file attachments. Try navigating between sessions in the sidebar, or open Settings to see the available options!",
  "Hello, Sensei! I'm running in **preview mode**, so I can't connect to the real AI backend.\n\nIn a production deployment I would answer your questions, assist with research, writing, coding, and much more. Feel free to keep exploring — all UI components are fully functional in this preview build. 🌸",
  "**Preview build note:** Backend connectivity is disabled in this environment.\n\nYou can still browse example conversations, switch sessions, adjust settings locally, and get a feel for the overall layout and interaction patterns of SCHALE Terminal.",
];

/** In-memory map used to persist new preview-session messages across session switches. */
export const previewSessionMessages = new Map<string, Message[]>();

export const normalizeLogLevel = (value: unknown): LogLevel => {
  if (value === "TRACE") {
    return "TRACE";
  }
  return "INFO";
};

const traceClientLog = (logLevel: LogLevel, event: string, payload: Record<string, unknown>): void => {
  if (logLevel !== "TRACE") {
    return;
  }
  console.debug(`[TRACE][chat.stream] ${event}`, payload);
};

const normalizeReasoningEffort = (value: unknown): ReasoningEffort => {
  if (value === "default" || value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value as ReasoningEffort;
  }
  return "default";
};

const normalizeTemporaryDailyBudgetUsd = (value: unknown): number | null => {
  if (value === null || value === undefined || String(value).trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0.01, parsed) : null;
};

const isCurrentUtcDate = (value: string | null | undefined): boolean => value === getCurrentUtcDate();

const normalizeServiceTier = (value: unknown): ServiceTier => {
  if (value === "flex" || value === "default" || value === "priority") {
    return value;
  }
  return "default";
};

export const normalizeChatSettings = (value: Partial<ChatGenerationSettings> | null | undefined): ChatGenerationSettings => {
  const maxOutputTokensRaw = Number(value?.max_output_tokens);
  let maxOutputTokens = Number.isFinite(maxOutputTokensRaw) ? Math.min(64000, Math.max(1, Math.round(maxOutputTokensRaw))) : 64000;
  if (maxOutputTokens >= 1024) {
    maxOutputTokens = Math.round(maxOutputTokens / 1024) * 1024;
  }
  const maxResultsRaw = Number(value?.web_search_max_results);
  const maxResults = Number.isFinite(maxResultsRaw) ? Math.min(25, Math.max(1, Math.round(maxResultsRaw))) : 5;
  const temporaryBudget = normalizeTemporaryDailyBudgetUsd(value?.temporary_daily_budget_usd);
  const temporaryDate = value?.temporary_daily_budget_date_utc ?? (temporaryBudget === null ? null : getCurrentUtcDate());
  const temporaryBudgetActive = temporaryBudget !== null && isCurrentUtcDate(temporaryDate);
  return {
    service_tier: normalizeServiceTier(value?.service_tier),
    reasoning_effort: normalizeReasoningEffort(value?.reasoning_effort),
    max_output_tokens: maxOutputTokens,
    daily_budget_usd: Number.isFinite(Number(value?.daily_budget_usd)) ? Math.max(0.01, Number(value?.daily_budget_usd)) : 10,
    temporary_daily_budget_usd: temporaryBudgetActive ? temporaryBudget : null,
    temporary_daily_budget_date_utc: temporaryBudgetActive ? temporaryDate : null,
    web_search_enabled: Boolean(value?.web_search_enabled),
    web_search_max_results: maxResults,
    attachment_mode: value?.attachment_mode === "base64" ? "base64" : "url",
    disable_max_output_tokens: value?.disable_max_output_tokens !== undefined ? Boolean(value.disable_max_output_tokens) : false,
    daily_budget_enabled: value?.daily_budget_enabled !== undefined ? Boolean(value.daily_budget_enabled) : true,
    text_file_extraction_mode: value?.text_file_extraction_mode === "url" ? "url" : "xml",
    image_compression_enabled: value?.image_compression_enabled !== undefined ? Boolean(value.image_compression_enabled) : true,
    image_max_dimension: Number.isFinite(Number(value?.image_max_dimension)) && Number(value?.image_max_dimension) > 0 ? Number(value?.image_max_dimension) : 2048,
  };
};

export const getCurrentUtcDate = (): string => new Date().toISOString().slice(0, 10);

export const calcBudgetStatus = (
  usage: UsageSummary | null,
  settings: ChatGenerationSettings,
  models: ModelOption[],
  selectedModel: string,
): DailyBudgetStatus => {
  const dateUtc = getCurrentUtcDate();
  const spent = Number(usage?.total_cost_usd ?? 0);
  const enabled = settings.daily_budget_enabled ?? true;
  if (!enabled) {
    return {
      date_utc: dateUtc,
      budget_usd: Infinity,
      spent_usd: spent,
      remaining_usd: Infinity,
      selected_model_output_usd_per_million: null,
      available_output_tokens: null,
    };
  }
  const temporaryBudgetActive = settings.temporary_daily_budget_usd !== null;
  const budget = Number(temporaryBudgetActive ? settings.temporary_daily_budget_usd : (settings.daily_budget_usd ?? 10));
  const remaining = Math.max(0, budget - spent);
  const model = models.find((m) => m.id === selectedModel);
  const multiplier = SERVICE_TIER_MULTIPLIERS[settings.service_tier] || 1.0;
  const outPrice = model?.pricing?.output_usd_per_million 
    ? model.pricing.output_usd_per_million * multiplier
    : null;
  const available = outPrice && outPrice > 0 ? Math.floor((remaining * 1_000_000 / outPrice) * 0.75) : null;
  return { date_utc: dateUtc, budget_usd: budget, spent_usd: spent, remaining_usd: remaining, selected_model_output_usd_per_million: outPrice, available_output_tokens: available };
};

export const warnBudget = (store: Store) => {
  const status = calcBudgetStatus(
    store.dailyUsage,
    store.chatSettings,
    store.models,
    store.selectedModel,
  );
  const available = status.available_output_tokens;
  if (available !== null && available < 8000) {
    store.pushToast(`预算预警：当前模型可用输出约 ${available} tokens。`, "info");
  }
};

export const resolveMaxOutputTokensOverride = (
  settings: ChatGenerationSettings,
  budgetStatus: DailyBudgetStatus,
): number => {
  const configuredMax = Math.max(1, Math.min(64000, Math.round(Number(settings.max_output_tokens) || 64000)));
  const availableMax = budgetStatus.available_output_tokens;
  let resultVal: number;
  if (!Number.isFinite(availableMax)) {
    resultVal = configuredMax;
  } else {
    resultVal = Math.max(1, Math.min(configuredMax, Math.round(availableMax)));
  }
  if (resultVal < 1024) {
    return resultVal;
  }
  return Math.round(resultVal / 1024) * 1024;
};

export const resolveAttachmentType = (mimeType: string): MessageAttachmentType => {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed.";
};

export const parseApiError = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error) {
      return data.error;
    }
  } catch {
    // ignore JSON parse error and fallback to status text
  }
  return response.statusText || `HTTP ${response.status}`;
};

export const requestJson = async <T>(path: string, init: RequestInitWithAuth = {}, retry = true): Promise<T> => {
  let currentToken = init.token;
  if (!currentToken) {
    currentToken = await useStore.getState().refreshClerkToken(false);
  }

  const headers = new Headers(init.headers);
  if (currentToken) {
    headers.set("Authorization", `Bearer ${currentToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && retry) {
    const nextToken = await useStore.getState().refreshClerkToken(true);
    if (nextToken) {
      return requestJson(path, { ...init, token: nextToken }, false);
    }
  }

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as T;
};

export const cancelUploadSession = async (sessionId: string, token: string | null): Promise<void> => {
  try {
    await fetch(`${API_URL}/api/upload-sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    // best-effort cleanup; ignore network errors
  }
};

export const uploadFileWithRetry = async (
  url: string,
  file: File,
  mimeType: string,
  token: string | null,
  onProgress?: (percent: number) => void,
  maxRetries = 3,
  retryAuth = true,
): Promise<Response> => {
  let lastError: unknown;
  const isPresignedUrl = (() => {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("x-amz-algorithm=") || lowerUrl.includes("x-amz-signature=") || lowerUrl.includes("sig=")) {
      return true;
    }
    try {
      const targetOrigin = new URL(url, window.location.origin).origin;
      const apiOrigin = new URL(API_URL, window.location.origin).origin;
      return targetOrigin !== apiOrigin;
    } catch {
      return false;
    }
  })();

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": mimeType,
      };

      let currentToken = token;
      if (!isPresignedUrl && !currentToken) {
        currentToken = await useStore.getState().refreshClerkToken(false);
      }

      // Do NOT send Authorization header to direct R2 presigned URLs
      if (!isPresignedUrl && currentToken) {
        headers["Authorization"] = `Bearer ${currentToken}`;
      }

      const response = onProgress && !isPresignedUrl
        ? await new Promise<Response>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          Object.entries(headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable || event.total <= 0) {
              return;
            }
            onProgress(Math.max(0, Math.min(99, (event.loaded / event.total) * 100)));
          };
          xhr.onload = () => {
            resolve(new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
            }));
          };
          xhr.onerror = () => reject(new Error("Upload request failed."));
          xhr.onabort = () => reject(new Error("Upload request aborted."));
          xhr.send(file);
        })
        : await fetch(url, {
          method: "PUT",
          headers,
          body: file,
        });

      if (response.ok) {
        onProgress?.(100);
        return response;
      }

      if (response.status === 401 && retryAuth && !isPresignedUrl) {
        const nextToken = await useStore.getState().refreshClerkToken(true);
        if (nextToken) {
          return uploadFileWithRetry(url, file, mimeType, nextToken, onProgress, maxRetries, false);
        }
      }

      // Only retry on 5xx or network errors
      if (response.status < 500) {
        return response;
      }

      throw new Error(`Upload failed with status ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        await new Promise((resolve) => { window.setTimeout(resolve, delay); });
      }
    }
  }

  throw lastError || new Error("Upload failed after retries.");
};

export const cropImageToSquare = async (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) {
    return file;
  }
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sourceX = Math.max(0, Math.floor((bitmap.width - side) / 2));
    const sourceY = Math.max(0, Math.floor((bitmap.height - side) / 2));
    const targetSize = Math.min(1024, side);

    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Cannot process avatar image.");
    }

    context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, targetSize, targetSize);

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, outputType === "image/png" ? undefined : 0.92);
    });
    if (!blob) {
      throw new Error("Failed to export avatar image.");
    }

    const fallbackExt = outputType === "image/png" ? "png" : "jpg";
    const nextName = file.name.replace(/\.[a-z0-9]+$/i, "") || "avatar";
    return new File([blob], `${nextName}.${fallbackExt}`, {
      type: blob.type || outputType,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
};

export interface ImageResizeOptions {
  enabled?: boolean;
  maxDimension?: number;
}

export const convertImageToSdrIfPossible = async (
  file: File,
  options?: ImageResizeOptions,
): Promise<File> => {
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    file.type === "image/svg+xml" ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }

  const compressionEnabled = options?.enabled ?? true;
  const maxDim = options?.maxDimension && options.maxDimension > 0 ? options.maxDimension : 2048;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const origWidth = bitmap.width;
    const origHeight = bitmap.height;

    const exceedsMaxDim = compressionEnabled && (origWidth > maxDim || origHeight > maxDim);

    if (!exceedsMaxDim && SDR_COMPATIBLE_IMAGE_TYPES.includes(file.type as (typeof SDR_COMPATIBLE_IMAGE_TYPES)[number])) {
      return file;
    }

    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (exceedsMaxDim) {
      const scale = maxDim / Math.max(origWidth, origHeight);
      targetWidth = Math.max(1, Math.round(origWidth * scale));
      targetHeight = Math.max(1, Math.round(origHeight * scale));
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const isPng = file.type === "image/png";
    const isWebp = file.type === "image/webp";
    const outputType = isPng ? "image/png" : isWebp ? "image/webp" : "image/jpeg";
    const quality = outputType === "image/png" ? undefined : 0.85;

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, quality);
    });

    if (!blob) {
      return file;
    }

    const extByType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const fallbackExt = extByType[outputType] ?? "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "image";
    return new File([blob], `${baseName}.${fallbackExt}`, {
      type: blob.type || outputType,
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
};

const parseSSEPayload = (rawEvent: string): unknown => {
  const lines = rawEvent.split(/\r\n|\r|\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = line.slice(5);
    dataLines.push(data.startsWith(" ") ? data.slice(1) : data);
  }
  if (!dataLines.length) {
    return null;
  }
  const payload = dataLines.join("\n").trim();
  if (!payload) {
    return null;
  }
  return JSON.parse(payload);
};

const readNextSSEEvent = (buffer: string): { event: string; rest: string } | null => {
  const boundaryMatch = /\r?\n\r?\n/.exec(buffer);
  if (!boundaryMatch || boundaryMatch.index === undefined) {
    return null;
  }

  return {
    event: buffer.slice(0, boundaryMatch.index),
    rest: buffer.slice(boundaryMatch.index + boundaryMatch[0].length),
  };
};

export type StreamSubmitResponse = {
  job_id: string;
  state: string;
  cursor?: string;
  user_message_id?: string;
};

export type StreamInflightState = {
  session_id: string;
  job_id: string | null;
  cursor: string;
  user_message_id: string | null;
  created_at: number;
};

export type StreamRecoveryState = {
  session_id: string;
  job_id: string | null;
  cursor: string;
  user_message_id: string | null;
  user_message_created_at: number | null;
  new_session: boolean;
  created_at: number;
  mode: "disconnected" | "reconnecting" | "waiting";
  last_error: string | null;
};

export type StreamFailureState = {
  session_id: string;
  job_id: string;
  user_message_id: string | null;
  user_message_created_at: number | null;
  error: string;
  content: string;
  reasoning: string;
  created_at: number;
};

export type StreamRecoveryLookupResponse = {
  session_id: string;
  job_id: string;
  cursor: string;
  user_message_id: string;
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  created_at: number;
  updated_at: number;
};

const streamInflightStorageKey = (sessionId: string): string => `${STREAM_INFLIGHT_PREFIX}${sessionId}`;

export const persistInflightStream = (sessionId: string, payload: StreamInflightState | null): void => {
  const key = streamInflightStorageKey(sessionId);
  try {
    if (!payload) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore localStorage failures (quota/private mode) and keep streaming functional.
  }
};

export const loadInflightStream = (sessionId: string): StreamInflightState | null => {
  const key = streamInflightStorageKey(sessionId);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StreamInflightState;
    const createdAt = Number(parsed?.created_at ?? 0);
    if (!parsed || parsed.session_id !== sessionId || !Number.isFinite(createdAt) || createdAt <= 0) {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - createdAt > STREAM_INFLIGHT_MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore localStorage failures.
    }
    return null;
  }
};

export const isRecentUserMessage = (message: Message | null | undefined): message is Message =>
  Boolean(message && message.role === "user" && Number.isFinite(Number(message.created_at)));

export const normalizeCursorSequence = (value: string | null | undefined): { cursor: string; sequence: number } => {
  const parsed = Number((value ?? "").trim());
  const sequence = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
  return {
    cursor: sequence > 0 ? String(sequence) : "",
    sequence,
  };
};

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException ? error.name === "AbortError" : error instanceof Error && error.name === "AbortError";

export const waitForAssistantMessage = async (
  token: string,
  sessionId: string,
  userMessageCreatedAt: number,
  logLevel: LogLevel,
): Promise<Message> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STREAM_EVENT_POLL_MAX_AGE_MS) {
    const data = await requestJson<{ messages: Message[] }>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "GET",
      token,
    });
    const assistantMessages = (data.messages ?? []).filter(
      (message) => message.role === "assistant" && Number(message.created_at) >= userMessageCreatedAt,
    );
    const latestAssistant = assistantMessages.at(-1);
    if (latestAssistant) {
      traceClientLog(logLevel, "events.poll.resolved", {
        session_id: sessionId,
        elapsed_ms: Date.now() - startedAt,
      });
      return latestAssistant;
    }
    traceClientLog(logLevel, "events.poll.wait", {
      session_id: sessionId,
      elapsed_ms: Date.now() - startedAt,
    });
    await new Promise((resolve) => window.setTimeout(resolve, STREAM_EVENT_POLL_INTERVAL_MS));
  }
  throw new Error("Timed out waiting for the assistant response.");
};

export const fetchSessionMessages = async (token: string | null, sessionId: string): Promise<Message[]> => {
  const data = await requestJson<{ messages: Message[] }>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: "GET",
    token,
  });
  return data.messages || [];
};

export const fetchStreamRecovery = async (token: string | null, sessionId: string, retry = true): Promise<StreamRecoveryLookupResponse | null> => {
  let currentToken = token;
  if (!currentToken) {
    currentToken = await useStore.getState().refreshClerkToken(false);
  }

  const response = await fetch(`${API_URL}/api/chat/stream/recovery?session_id=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
  });
  if (response.status === 401 && retry) {
    const nextToken = await useStore.getState().refreshClerkToken(true);
    if (nextToken) {
      return fetchStreamRecovery(nextToken, sessionId, false);
    }
  }
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = await response.json() as { recovery?: StreamRecoveryLookupResponse | null };
  return data.recovery ?? null;
};

export const resolveRecoveryUserMessageCreatedAt = (
  messages: Message[],
  userMessageId: string | null | undefined,
): number | null => {
  const normalizedUserMessageId = userMessageId?.trim() || null;
  if (normalizedUserMessageId) {
    const matched = messages.find((message) => message.id === normalizedUserMessageId && message.role === "user");
    if (matched && Number.isFinite(Number(matched.created_at))) {
      return Number(matched.created_at);
    }
  }
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && Number.isFinite(Number(message.created_at))) {
      return Number(message.created_at);
    }
  }
  return null;
};

export const buildDisconnectedRecoveryState = (
  sessionId: string,
  jobId: string | null,
  cursor: string,
  userMessageId: string | null,
  userMessageCreatedAt: number | null,
  lastError: string,
): StreamRecoveryState => ({
  session_id: sessionId,
  job_id: jobId,
  cursor,
  user_message_id: userMessageId,
  user_message_created_at: userMessageCreatedAt,
  new_session: false,
  created_at: Date.now(),
  mode: "disconnected",
  last_error: lastError,
});

export const buildStreamFailureState = (
  sessionId: string,
  jobId: string,
  userMessageId: string | null,
  userMessageCreatedAt: number | null,
  error: string,
  content: string,
  reasoning: string,
): StreamFailureState => ({
  session_id: sessionId,
  job_id: jobId,
  user_message_id: userMessageId,
  user_message_created_at: userMessageCreatedAt,
  error,
  content,
  reasoning,
  created_at: Date.now(),
});

export const consumeChatStream = async (
  token: string | null,
  sessionId: string,
  jobId: string,
  initialCursor: string,
  logLevel: LogLevel,
  onMessageDelta: (content: string) => void,
  onReasoningDelta: (reasoning: string) => void,
  initialContent: string = "",
  initialReasoning: string = "",
  retry = true,
): Promise<{ content: string; reasoning: string; warning: string | null; failure: string | null; userMessageId: string | null; cursor: string }> => {
  const normalizedInitialCursor = normalizeCursorSequence(initialCursor);
  let cursor = normalizedInitialCursor.cursor;
  let lastSequence = normalizedInitialCursor.sequence;
  let streamedContent = initialContent;
  let streamedReasoning = initialReasoning;
  let userMessageId: string | null = null;
  let terminal = false;
  let failure: string | null = null;
  let lastPersistedAt = 0;
  let lastPersistedSequence = lastSequence;
  let lastPersistedUserMessageId: string | null = null;

  // Buffer state for performance (Buffered Rendering Pipeline)
  let bufferedContent = "";
  let bufferedReasoning = "";
  let needsUpdate = false;
  let updateTimer: number | null = null;
  let lastFlushAt = 0;
  const FLUSH_INTERVAL_MS = 80;

  const flushUpdates = () => {
    if (updateTimer !== null) {
      window.clearTimeout(updateTimer);
      updateTimer = null;
    }
    if (!needsUpdate) return;
    onMessageDelta(bufferedContent);
    onReasoningDelta(bufferedReasoning);
    needsUpdate = false;
    lastFlushAt = Date.now();
  };

  const scheduleUpdate = (content: string, reasoning: string) => {
    bufferedContent = content;
    bufferedReasoning = reasoning;
    needsUpdate = true;

    if (updateTimer !== null) return;

    const now = Date.now();
    const timeSinceLastFlush = now - lastFlushAt;
    const delay = Math.max(0, FLUSH_INTERVAL_MS - timeSinceLastFlush);

    updateTimer = window.setTimeout(flushUpdates, delay);
  };

  while (!terminal) {
    traceClientLog(logLevel, "events.fetch.begin", { session_id: sessionId, job_id: jobId, cursor });
    const controller = new AbortController();
    let stallTimer: number | null = null;
    let connectionTimer: number | null = null;
    const resetStallTimer = () => {
      if (stallTimer !== null) {
        window.clearTimeout(stallTimer);
      }
      stallTimer = window.setTimeout(() => controller.abort(), STREAM_EVENT_STALL_TIMEOUT_MS);
    };

    try {
      let currentToken = token;
      if (!currentToken) {
        currentToken = await useStore.getState().refreshClerkToken(false);
      }
      if (!currentToken) {
        throw new Error("Authentication token is missing.");
      }

      resetStallTimer();
      const response = await new Promise<Response>((resolve, reject) => {
        connectionTimer = window.setTimeout(() => {
          controller.abort();
          reject(new Error("Stream connection timed out."));
        }, STREAM_EVENT_CONNECTION_TIMEOUT_MS);
        void fetch(
          `${API_URL}/api/chat/stream/events?session_id=${encodeURIComponent(sessionId)}&job_id=${encodeURIComponent(jobId)}&cursor=${encodeURIComponent(cursor)}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${currentToken}`,
            },
            signal: controller.signal,
          },
        ).then((response) => {
          if (connectionTimer !== null) {
            window.clearTimeout(connectionTimer);
            connectionTimer = null;
          }
          resolve(response);
        }).catch((error) => {
          if (connectionTimer !== null) {
            window.clearTimeout(connectionTimer);
            connectionTimer = null;
          }
          reject(error);
        });
      });

      if (response.status === 401 && retry) {
        const nextToken = await useStore.getState().refreshClerkToken(true);
        if (nextToken) {
          return consumeChatStream(
            nextToken,
            sessionId,
            jobId,
            cursor,
            logLevel,
            onMessageDelta,
            onReasoningDelta,
            streamedContent,
            streamedReasoning,
            false,
          );
        }
      }

      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      if (!response.body) {
        throw new Error("Empty response stream.");
      }
      traceClientLog(logLevel, "events.fetch.connected", { session_id: sessionId, job_id: jobId, cursor, status: response.status });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      const handleRawEvent = (rawEvent: string): boolean => {
        if (!rawEvent.trim()) {
          return false;
        }
        let parsed: unknown;
        try {
          parsed = parseSSEPayload(rawEvent);
        } catch (error) {
          console.error("Failed to parse SSE event", error);
          return false;
        }
        if (!parsed || typeof parsed !== "object") {
          return false;
        }
        const payload = parsed as Record<string, unknown>;
        const sequenceCandidateRaw = Number(payload.sequence);
        const cursorCandidateRaw = Number(payload.cursor);
        const sequenceRaw = Number.isFinite(sequenceCandidateRaw)
          ? sequenceCandidateRaw
          : cursorCandidateRaw;
        const sequence = Number.isFinite(sequenceRaw) ? Math.floor(sequenceRaw) : 0;
        if (sequence > 0) {
          if (sequence <= lastSequence) {
            return false;
          }
          lastSequence = sequence;
          cursor = String(sequence);
        }

        if (typeof payload.user_message_id === "string" && payload.user_message_id.trim()) {
          userMessageId = payload.user_message_id.trim();
        }
        if (sequence > 0) {
          const now = Date.now();
          const shouldPersist = (
            now - lastPersistedAt >= STREAM_INFLIGHT_PERSIST_MIN_INTERVAL_MS
            || sequence - lastPersistedSequence >= STREAM_INFLIGHT_PERSIST_MIN_SEQUENCE_DELTA
            || userMessageId !== lastPersistedUserMessageId
          );
          if (shouldPersist) {
            persistInflightStream(sessionId, {
              session_id: sessionId,
              job_id: jobId,
              cursor,
              user_message_id: userMessageId,
              created_at: now,
            });
            lastPersistedAt = now;
            lastPersistedSequence = sequence;
            lastPersistedUserMessageId = userMessageId;
          }
        }
        const type = typeof payload.type === "string" ? payload.type : "";
        traceClientLog(logLevel, "events.message", { session_id: sessionId, job_id: jobId, sequence, type });
        const eventPayload = (typeof payload.payload === "object" && payload.payload !== null)
          ? payload.payload as Record<string, unknown>
          : {};
        if (type === "content_delta") {
          const piece = typeof eventPayload.content_delta === "string" ? eventPayload.content_delta : "";
          if (piece) {
            streamedContent += piece;
            scheduleUpdate(streamedContent, streamedReasoning);
          }
        }
        if (type === "reasoning_delta") {
          let piece = "";
          const rawDelta = eventPayload.reasoning_delta !== undefined ? eventPayload.reasoning_delta : payload.reasoning_delta;
          if (rawDelta !== undefined && rawDelta !== null) {
            piece = String(rawDelta);
          }
          if (piece) {
            streamedReasoning += piece;
            scheduleUpdate(streamedContent, streamedReasoning);
          }
        }
        if (type === "job_failed") {
          failure = typeof eventPayload.error === "string" ? eventPayload.error : "Streaming failed.";
          terminal = true;
          return true;
        }
        if (type === "job_completed") {
          terminal = true;
          traceClientLog(logLevel, "events.terminal_completed", { session_id: sessionId, job_id: jobId, sequence });
        }
        return terminal;
      };

      while (true) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await reader.read();
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) {
            traceClientLog(logLevel, "events.fetch.stalled", { session_id: sessionId, job_id: jobId, cursor });
            flushUpdates();
            return {
              content: streamedContent,
              reasoning: streamedReasoning,
              warning: "stream stalled",
              failure: null,
              userMessageId,
              cursor,
            };
          }
          throw error;
        }
        resetStallTimer();
        const { done, value } = readResult;
        streamBuffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        let nextEvent = readNextSSEEvent(streamBuffer);
        while (nextEvent) {
          streamBuffer = nextEvent.rest;
          if (handleRawEvent(nextEvent.event)) {
            break;
          }
          nextEvent = readNextSSEEvent(streamBuffer);
        }
        if (terminal) {
          break;
        }
        if (done) {
          if (handleRawEvent(streamBuffer)) {
            break;
          }
          streamBuffer = "";
          break;
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && !isAbortError(error)) {
        throw error;
      }
      return {
        content: streamedContent,
        reasoning: streamedReasoning,
        warning: "stream stalled",
        failure: null,
        userMessageId,
        cursor,
      };
    } finally {
      if (connectionTimer !== null) {
        window.clearTimeout(connectionTimer);
      }
      if (stallTimer !== null) {
        window.clearTimeout(stallTimer);
      }
    }
  }
  traceClientLog(logLevel, "events.done", { session_id: sessionId, job_id: jobId, cursor, content_length: streamedContent.length });
  flushUpdates();

  return {
    content: streamedContent,
    reasoning: streamedReasoning,
    warning: null,
    failure,
    userMessageId,
    cursor,
  };
};

export const ensureToken = (token: string | null): string => {
  if (!token) {
    throw new Error("Authentication required.");
  }
  return token;
};

export const replaceMessageId = (messages: Message[], currentId: string, nextId: string | null): Message[] => {
  if (!nextId || nextId === currentId) {
    return messages;
  }
  const targetIndex = messages.findIndex((message) => message.id === currentId);
  if (targetIndex < 0) {
    return messages;
  }
  const nextMessages = [...messages];
  nextMessages[targetIndex] = { ...nextMessages[targetIndex], id: nextId };
  return nextMessages;
};

export const extractLastThinkingTopic = (text: string): string => {
  if (!text) return "";

  const lines = text.split("\n");
  let lastTopic = "";

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("**")) {
      const closingIdx = trimmed.indexOf("**", 2);
      if (closingIdx !== -1) {
        lastTopic = trimmed.slice(2, closingIdx).trim();
      } else {
        const hasSubsequentNonEmptyLines = lines.slice(i + 1).some((l) => l.trim().length > 0);
        if (!hasSubsequentNonEmptyLines) {
          lastTopic = trimmed.slice(2).trim();
        }
      }
    }
  }

  if (!lastTopic && text.trim().length > 0) {
    return "Thinking...";
  }

  return lastTopic;
};

import { createAuthSlice } from "./slices/authSlice";
import { createChatSlice } from "./slices/chatSlice";
import { createWorkspaceSlice } from "./slices/workspaceSlice";
import { createAdminSlice } from "./slices/adminSlice";
import { createSettingsSlice } from "./slices/settingsSlice";

export const useStore = create<Store>((set, get, store) => ({
  toasts: [],
  pushToast: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    window.setTimeout(() => {
      get().dismissToast(id);
    }, 4200);
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },

  ...createAuthSlice(set, get, store),
  ...createChatSlice(set, get, store),
  ...createWorkspaceSlice(set, get, store),
  ...createAdminSlice(set, get, store),
  ...createSettingsSlice(set, get, store),
}));
